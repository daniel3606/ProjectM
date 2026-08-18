import SwiftUI
import FamilyControls

@available(iOS 16.0, *)
struct ScreenTimePickerView: View {
    @State var selection: FamilyActivitySelection
    let onComplete: (FamilyActivitySelection) -> Void
    let onCancel: () -> Void

    init(
        initialSelection: FamilyActivitySelection,
        onComplete: @escaping (FamilyActivitySelection) -> Void,
        onCancel: @escaping () -> Void
    ) {
        _selection = State(initialValue: initialSelection)
        self.onComplete = onComplete
        self.onCancel = onCancel
    }

    var body: some View {
        NavigationStack {
            FamilyActivityPicker(selection: $selection)
                .navigationTitle("Select Apps")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            onCancel()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            onComplete(selection)
                        }
                    }
                }
        }
    }
}
