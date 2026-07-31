const {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const TARGET_NAME = "TimedBlockMonitor";
const APP_GROUP_ID = "group.com.dllim.marshmallow";
const SOURCE_DIR = path.join(__dirname, "..", "targets", TARGET_NAME);
const SHARED_STATE_FILE = "SharedBlockState.swift";
const SHARED_STATE_SOURCE = path.join(
  __dirname,
  "..",
  "modules",
  "screen-time",
  "ios",
  SHARED_STATE_FILE
);

// `xcode` package's pbxTargetByName/updateBuildProperty(targetName) match
// against the target's *comment*, which addTarget() leaves double-quoted
// (`"TimedBlockMonitor"`) — an unquoted name never matches, so both silently
// no-op instead of erroring. Look targets up by their real `name` field
// instead, trimming the quotes ourselves.
function findTarget(project, name) {
  const targets = project.pbxNativeTargetSection();
  for (const key of Object.keys(targets)) {
    if (key.endsWith("_comment")) continue;
    const t = targets[key];
    if (t && typeof t.name === "string" && t.name.replace(/^"|"$/g, "") === name) {
      return { uuid: key, pbxNativeTarget: t };
    }
  }
  return null;
}

function targetBuildConfigs(project, target, build) {
  const configListUuid = target.pbxNativeTarget.buildConfigurationList;
  const configList = project.pbxXCConfigurationList()[configListUuid];
  const buildConfigSection = project.pbxXCBuildConfigurationSection();
  return configList.buildConfigurations
    .map(({ value }) => buildConfigSection[value])
    .filter((c) => !build || c.name === build);
}

function setTargetBuildSetting(project, target, prop, value) {
  for (const config of targetBuildConfigs(project, target)) {
    config.buildSettings[prop] = value;
  }
}

function getTargetBuildSetting(project, target, prop, build) {
  for (const config of targetBuildConfigs(project, target, build)) {
    if (config.buildSettings[prop] !== undefined) return config.buildSettings[prop];
  }
  return undefined;
}

// Adds the TimedBlockMonitor DeviceActivityMonitor extension target so
// scheduled blocks can start/end at the OS level even when the app isn't
// running (see modules/screen-time/ios/ScreenTimeModule.swift's
// scheduleTimedBlocks + targets/TimedBlockMonitor). Xcode project targets
// can't be expressed in app.json directly, so this plugin builds the target
// by hand with the `xcode` package (the same one @expo/config-plugins uses
// internally) every time `expo prebuild` regenerates ios/.
module.exports = function withTimedBlockMonitor(config) {
  config = withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.security.application-groups"] = [APP_GROUP_ID];
    return config;
  });

  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const destDir = path.join(projectRoot, TARGET_NAME);
      fs.mkdirSync(destDir, { recursive: true });

      for (const file of fs.readdirSync(SOURCE_DIR)) {
        fs.copyFileSync(path.join(SOURCE_DIR, file), path.join(destDir, file));
      }
      // Duplicated (not symlinked) so the extension gets its own compiled
      // copy — the original under modules/screen-time/ios compiles into the
      // main app via ScreenTime.podspec's file glob, and that target has no
      // DeviceActivity/extension entitlements to share this copy with.
      fs.copyFileSync(SHARED_STATE_SOURCE, path.join(destDir, SHARED_STATE_FILE));

      // `pod install` fails on this project without `use_modular_headers!`
      // (AppCheckCore's Swift pod can't import GoogleUtilities/RecaptchaInterop,
      // which don't define modules, when building as static libraries) — every
      // `expo prebuild` regenerates ios/Podfile from scratch, so this has to be
      // patched back in every time rather than hand-edited once.
      const podfilePath = path.join(projectRoot, "Podfile");
      const podfile = fs.readFileSync(podfilePath, "utf8");
      if (!podfile.includes("use_modular_headers!")) {
        fs.writeFileSync(
          podfilePath,
          podfile.replace(
            /^(target ['"].+['"] do\n)/m,
            "$1  use_modular_headers!\n"
          )
        );
      }

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const bundleId = `${config.ios.bundleIdentifier}.${TARGET_NAME}`;

    if (findTarget(project, TARGET_NAME)) {
      // Already added by a previous prebuild pass over the same project.
      return config;
    }

    const target = project.addTarget(TARGET_NAME, "app_extension", TARGET_NAME, bundleId);

    project.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    // addSourceFile needs a real PBXGroup key to resolve `<group>`-relative
    // paths against — this project has no "Plugins" group (the fallback used
    // when no group is passed), so without this every addSourceFile call
    // throws deep inside pbxProject.js's path-correction helper. No `path` on
    // the group itself (undefined, purely organizational) — the file
    // references below already carry the full `TimedBlockMonitor/...` path,
    // so a group path here would double it up.
    const group = project.addPbxGroup([], TARGET_NAME);
    // addPbxGroup always writes a `path` key, even when passed undefined —
    // it serializes as the literal string "undefined", which Xcode then
    // treats as a real subfolder name. Strip it so the group is purely
    // organizational (see the path-doubling comment above).
    delete group.pbxGroup.path;
    const mainGroupId = project.getFirstProject().firstProject.mainGroup;
    project.getPBXGroupByKey(mainGroupId).children.push({
      value: group.uuid,
      comment: TARGET_NAME,
    });

    for (const file of fs.readdirSync(SOURCE_DIR)) {
      if (file.endsWith(".swift")) {
        project.addSourceFile(`${TARGET_NAME}/${file}`, { target: target.uuid }, group.uuid);
      }
    }
    project.addSourceFile(
      `${TARGET_NAME}/${SHARED_STATE_FILE}`,
      { target: target.uuid },
      group.uuid
    );

    for (const framework of ["DeviceActivity", "FamilyControls", "ManagedSettings"]) {
      project.addFramework(`${framework}.framework`, { target: target.uuid });
    }

    setTargetBuildSetting(
      project,
      target,
      "CODE_SIGN_ENTITLEMENTS",
      `${TARGET_NAME}/${TARGET_NAME}.entitlements`
    );
    setTargetBuildSetting(project, target, "SWIFT_VERSION", "5.0");
    setTargetBuildSetting(project, target, "IPHONEOS_DEPLOYMENT_TARGET", "16.0");
    setTargetBuildSetting(project, target, "TARGETED_DEVICE_FAMILY", '"1,2"');
    setTargetBuildSetting(project, target, "CODE_SIGN_STYLE", "Automatic");

    // Best-effort: carry over whatever signing team the main app target is
    // already using, so a fresh prebuild doesn't need the user to manually
    // re-pick a team for this target too.
    const mainTarget = { pbxNativeTarget: project.getFirstTarget().firstTarget };
    const mainTeam = getTargetBuildSetting(project, mainTarget, "DEVELOPMENT_TEAM", "Release");
    if (mainTeam) {
      setTargetBuildSetting(project, target, "DEVELOPMENT_TEAM", mainTeam);
    }

    return config;
  });

  return config;
};
