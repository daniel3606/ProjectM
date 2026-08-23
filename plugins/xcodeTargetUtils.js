// Shared helpers for hand-rolled Expo config plugins that add native Xcode
// targets (app extensions) via the `xcode` package. Used by
// withTimedBlockMonitor.js and withMarshmallowWidget.js.

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

module.exports = {
  findTarget,
  targetBuildConfigs,
  setTargetBuildSetting,
  getTargetBuildSetting,
};
