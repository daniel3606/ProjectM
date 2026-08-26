const {
  withInfoPlist,
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

const TARGET_NAME = "QuickBlockLiveActivity";
const SOURCE_DIR = path.join(__dirname, "..", "targets", TARGET_NAME);
const ATTRIBUTES_FILE = "QuickBlockActivityAttributes.swift";
const SHARED_STATE_FILE = "SharedBlockState.swift";
const ATTRIBUTES_SOURCE = path.join(
  __dirname,
  "..",
  "modules",
  "screen-time",
  "ios",
  ATTRIBUTES_FILE
);
const SHARED_STATE_SOURCE = path.join(
  __dirname,
  "..",
  "modules",
  "screen-time",
  "ios",
  SHARED_STATE_FILE
);

// Adds the QuickBlockLiveActivity WidgetKit extension target for ActivityKit
// Live Activities, used by both Quick Blocks and Timed Blocks — the target
// name predates Timed Block support and is kept so the extension's bundle id
// stays stable. The shared BlockAttributes struct is compiled into both the
// main app (for Activity.request) and this extension (for the Live Activity UI).
module.exports = function withQuickBlockLiveActivity(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
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
      fs.copyFileSync(ATTRIBUTES_SOURCE, path.join(destDir, ATTRIBUTES_FILE));
      fs.copyFileSync(SHARED_STATE_SOURCE, path.join(destDir, SHARED_STATE_FILE));

      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const bundleId = `${config.ios.bundleIdentifier}.${TARGET_NAME}`;

    if (findTarget(project, TARGET_NAME)) {
      return config;
    }

    const target = project.addTarget(TARGET_NAME, "app_extension", TARGET_NAME, bundleId);

    project.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

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
      `${TARGET_NAME}/${ATTRIBUTES_FILE}`,
      { target: target.uuid },
      group.uuid
    );
    project.addSourceFile(
      `${TARGET_NAME}/${SHARED_STATE_FILE}`,
      { target: target.uuid },
      group.uuid
    );

    for (const framework of ["WidgetKit", "SwiftUI", "ActivityKit"]) {
      project.addFramework(`${framework}.framework`, { target: target.uuid });
    }

    setTargetBuildSetting(
      project,
      target,
      "CODE_SIGN_ENTITLEMENTS",
      `${TARGET_NAME}/${TARGET_NAME}.entitlements`
    );
    setTargetBuildSetting(
      project,
      target,
      "INFOPLIST_FILE",
      `${TARGET_NAME}/${TARGET_NAME}-Info.plist`
    );
    setTargetBuildSetting(project, target, "SWIFT_VERSION", "5.0");
    setTargetBuildSetting(project, target, "IPHONEOS_DEPLOYMENT_TARGET", "16.2");
    setTargetBuildSetting(project, target, "TARGETED_DEVICE_FAMILY", '"1,2"');
    setTargetBuildSetting(project, target, "CODE_SIGN_STYLE", "Automatic");

    const mainTarget = { pbxNativeTarget: project.getFirstTarget().firstTarget };
    const mainTeam = getTargetBuildSetting(project, mainTarget, "DEVELOPMENT_TEAM", "Release");
    if (mainTeam) {
      setTargetBuildSetting(project, target, "DEVELOPMENT_TEAM", mainTeam);
    }

    return config;
  });

  return config;
};
