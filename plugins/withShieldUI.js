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

const APP_GROUP_ID = "group.com.dllim.marshmallow";
const SHARED_STATE_FILE = "SharedBlockState.swift";
const SHARED_STATE_SOURCE = path.join(
  __dirname,
  "..",
  "modules",
  "screen-time",
  "ios",
  SHARED_STATE_FILE
);

// Replacing the shield — the screen iOS puts over a blocked app — takes two
// extension points, and Apple gives each its own. One supplies the screen,
// the other answers its buttons; neither can do the other's job, and a shield
// with only the first draws buttons that do nothing.
const TARGETS = [
  {
    name: "MarshmallowShield",
    frameworks: ["ManagedSettings", "ManagedSettingsUI", "UIKit"],
    // Draws the user's own marshmallow and names their block, both of which
    // it reads out of the App Group the app writes to.
    needsSharedState: true,
  },
  {
    name: "MarshmallowShieldAction",
    frameworks: ["ManagedSettings"],
    needsSharedState: false,
  },
];

// Adds both shield extension targets. Mirrors withTimedBlockMonitor.js and
// withMarshmallowWidget.js in hand-building the Xcode targets with the
// `xcode` package, since Expo has no config-plugin primitive for native
// targets and `expo prebuild` regenerates ios/ from scratch every time.
module.exports = function withShieldUI(config) {
  config = withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.security.application-groups"] = [APP_GROUP_ID];
    return config;
  });

  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;

      for (const target of TARGETS) {
        const sourceDir = path.join(__dirname, "..", "targets", target.name);
        const destDir = path.join(projectRoot, target.name);
        fs.mkdirSync(destDir, { recursive: true });

        for (const file of fs.readdirSync(sourceDir)) {
          fs.copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
        }
        // Duplicated (not symlinked), same reasoning as withTimedBlockMonitor.js
        // — every target compiles its own copy independent of the main app's.
        if (target.needsSharedState) {
          fs.copyFileSync(SHARED_STATE_SOURCE, path.join(destDir, SHARED_STATE_FILE));
        }
      }

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;

    for (const target of TARGETS) {
      addTarget(project, config.ios.bundleIdentifier, target);
    }

    return config;
  });

  return config;
};

function addTarget(project, appBundleId, { name, frameworks, needsSharedState }) {
  if (findTarget(project, name)) {
    // Already added by a previous prebuild pass over the same project.
    return;
  }

  const target = project.addTarget(name, "app_extension", name, `${appBundleId}.${name}`);

  project.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
  project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
  project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

  // See withTimedBlockMonitor.js for why the group needs no `path` and why
  // addSourceFile needs a real PBXGroup key to resolve against.
  const group = project.addPbxGroup([], name);
  delete group.pbxGroup.path;
  const mainGroupId = project.getFirstProject().firstProject.mainGroup;
  project.getPBXGroupByKey(mainGroupId).children.push({ value: group.uuid, comment: name });

  const sourceDir = path.join(__dirname, "..", "targets", name);
  for (const file of fs.readdirSync(sourceDir)) {
    if (file.endsWith(".swift")) {
      project.addSourceFile(`${name}/${file}`, { target: target.uuid }, group.uuid);
    }
  }
  if (needsSharedState) {
    project.addSourceFile(`${name}/${SHARED_STATE_FILE}`, { target: target.uuid }, group.uuid);
  }

  for (const framework of frameworks) {
    project.addFramework(`${framework}.framework`, { target: target.uuid });
  }

  setTargetBuildSetting(project, target, "CODE_SIGN_ENTITLEMENTS", `${name}/${name}.entitlements`);
  setTargetBuildSetting(project, target, "SWIFT_VERSION", "5.0");
  setTargetBuildSetting(project, target, "IPHONEOS_DEPLOYMENT_TARGET", "16.0");
  setTargetBuildSetting(project, target, "TARGETED_DEVICE_FAMILY", '"1,2"');
  setTargetBuildSetting(project, target, "CODE_SIGN_STYLE", "Automatic");

  // Best-effort: carry over whatever signing team the main app target is
  // already using, so a fresh prebuild doesn't need the user to manually
  // re-pick a team for these targets too.
  const mainTarget = { pbxNativeTarget: project.getFirstTarget().firstTarget };
  const mainTeam = getTargetBuildSetting(project, mainTarget, "DEVELOPMENT_TEAM", "Release");
  if (mainTeam) {
    setTargetBuildSetting(project, target, "DEVELOPMENT_TEAM", mainTeam);
  }
}
