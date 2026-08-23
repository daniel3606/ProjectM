const {
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
const {
  findTarget,
  setTargetBuildSetting,
  getTargetBuildSetting,
} = require("./xcodeTargetUtils");

const TARGET_NAME = "MarshmallowWidget";
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

// Adds the MarshmallowWidget WidgetKit extension target (the 2x2 home-screen
// widget) — reads the same App Group SharedBlockState that ScreenTimeModule
// and TimedBlockMonitor already write to, but never calls any Screen Time
// API itself. Mirrors withTimedBlockMonitor.js's approach to hand-building
// an Xcode target with the `xcode` package, since Expo has no config-plugin
// primitive for adding native targets directly.
module.exports = function withMarshmallowWidget(config) {
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
      // Duplicated (not symlinked), same reasoning as withTimedBlockMonitor.js
      // — this target compiles its own copy independent of the main app's.
      fs.copyFileSync(SHARED_STATE_SOURCE, path.join(destDir, SHARED_STATE_FILE));

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

    // See withTimedBlockMonitor.js for why the group needs no `path` and why
    // addSourceFile needs a real PBXGroup key to resolve against.
    const group = project.addPbxGroup([], TARGET_NAME);
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

    for (const framework of ["WidgetKit", "SwiftUI"]) {
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
