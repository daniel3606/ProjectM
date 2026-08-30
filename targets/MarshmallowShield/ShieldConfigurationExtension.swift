import ManagedSettings
import ManagedSettingsUI

// Runs inside the MarshmallowShield app extension, which iOS launches on its
// own whenever it is about to shield something ScreenTimeModule or
// TimedBlockMonitorExtension put behind a block. All four entry points hand
// off to the same screen; only the name of what was blocked differs.
class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        ShieldPresentation.configuration(subject: application.localizedDisplayName)
    }

    override func configuration(
        shielding application: Application,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        // Naming the app is more useful than naming the category it fell into,
        // so the category is only a fallback.
        ShieldPresentation.configuration(
            subject: application.localizedDisplayName ?? category.localizedDisplayName
        )
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        ShieldPresentation.configuration(subject: webDomain.domain)
    }

    override func configuration(
        shielding webDomain: WebDomain,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        ShieldPresentation.configuration(
            subject: webDomain.domain ?? category.localizedDisplayName
        )
    }
}
