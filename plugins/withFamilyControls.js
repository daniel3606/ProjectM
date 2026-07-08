const { withEntitlementsPlist } = require("@expo/config-plugins");

module.exports = function withFamilyControls(config) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.developer.family-controls"] = true;
    return config;
  });
};
