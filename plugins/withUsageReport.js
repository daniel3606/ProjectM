const { withXcodeProject, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
const {
  findTarget,
  setTargetBuildSetting,
  getTargetBuildSetting,
} = require("./xcodeTargetUtils");

const TARGET_NAME = "MarshmallowUsageReport";
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

// Adds the MarshmallowUsageReport DeviceActivityReport extension target.
//
// This extension is the only part of the product that can see real
// screen-time figures: iOS hands them to a report extension and sandboxes it
// so nothing carries them back to the app. The app hosts the result through
// ScreenTimeUsageReportView; targets/MarshmallowUsageReport has the detail.
//
// Built by hand with the `xcode` package for the same reason as
// withTimedBlockMonitor: Xcode targets can't be expressed in app.json, and
// every `expo prebuild` regenerates ios/ from scratch.
//
// No entitlements mod here — withFamilyControls and withTimedBlockMonitor
// already put family-controls and the App Group on the main app, and this
// target carries its own copy in its .entitlements file.
module.exports = function withUsageReport(config) {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const destDir = path.join(projectRoot, TARGET_NAME);
      fs.mkdirSync(destDir, { recursive: true });

      for (const file of fs.readdirSync(SOURCE_DIR)) {
        fs.copyFileSync(path.join(SOURCE_DIR, file), path.join(destDir, file));
      }
      // The extension reads the window boundary the app writes, so it needs
      // its own compiled copy of the shared keys — see withTimedBlockMonitor
      // for why this is duplicated rather than shared.
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

    // `addTarget` registers the new target as a dependency of the app, but
    // quietly skips it when either of these sections is missing — and an
    // Expo-generated project has neither. Without the dependency a headless
    // `xcodebuild -scheme Marshmallow` embeds whatever .appex it happens to
    // find already built, and silently ships an app without this one.
    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    const target = project.addTarget(TARGET_NAME, "app_extension", TARGET_NAME, bundleId);

    project.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    // See withTimedBlockMonitor for why the group is created explicitly and
    // why its `path` is deleted afterwards.
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

    const mainTarget = { pbxNativeTarget: project.getFirstTarget().firstTarget };
    const mainTeam = getTargetBuildSetting(project, mainTarget, "DEVELOPMENT_TEAM", "Release");
    if (mainTeam) {
      setTargetBuildSetting(project, target, "DEVELOPMENT_TEAM", mainTeam);
    }

    return config;
  });

  return config;
};
