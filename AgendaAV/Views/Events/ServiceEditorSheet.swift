import SwiftData
import SwiftUI

struct ServiceEditorSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    var onCreated: ((CatalogService) -> Void)?

    @State private var name = ""
    @State private var validationMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Servicio / trabajo") {
                    TextField("Nombre", text: $name)
                    Text("Queda guardado en la lista para agendarlo más rápido después.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Nuevo servicio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar", action: save)
                        .fontWeight(.semibold)
                }
            }
            .alert("Revisa el formulario", isPresented: Binding(
                get: { validationMessage != nil },
                set: { if !$0 { validationMessage = nil } }
            )) {
                Button("OK", role: .cancel) { validationMessage = nil }
            } message: {
                Text(validationMessage ?? "")
            }
        }
        .presentationDetents([.medium])
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            validationMessage = "Escribe el nombre del servicio."
            return
        }
        let created = CatalogService(name: trimmed)
        modelContext.insert(created)
        try? modelContext.save()
        onCreated?(created)
        dismiss()
    }
}
