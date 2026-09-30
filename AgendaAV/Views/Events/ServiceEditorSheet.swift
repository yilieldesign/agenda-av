import SwiftData
import SwiftUI

struct ServiceEditorSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var catalog: [CatalogService]
    @Query private var events: [WorkEvent]

    let service: CatalogService?
    var onCreated: ((CatalogService) -> Void)?
    var onDeleted: ((UUID) -> Void)?

    @State private var name: String
    @State private var validationMessage: String?
    @State private var showingDeleteConfirm = false

    init(
        service: CatalogService? = nil,
        onCreated: ((CatalogService) -> Void)? = nil,
        onDeleted: ((UUID) -> Void)? = nil
    ) {
        self.service = service
        self.onCreated = onCreated
        self.onDeleted = onDeleted
        _name = State(initialValue: service?.name ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Servicio") {
                    TextField("Nombre", text: $name)
                    Text(service == nil
                         ? "Queda guardado en la lista para agendarlo más rápido después."
                         : "Cambia el nombre o quítalo de la lista. Los trabajos ya agendados conservan lo que tenían.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if service != nil {
                    Section {
                        Button("Eliminar servicio", role: .destructive) {
                            showingDeleteConfirm = true
                        }
                    }
                }
            }
            .navigationTitle(service == nil ? "Nuevo servicio" : "Editar servicio")
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
            .alert("¿Quitar este servicio de la lista?", isPresented: $showingDeleteConfirm) {
                Button("Eliminar", role: .destructive, action: deleteService)
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Los trabajos ya agendados no se borran.")
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
        let duplicate = catalog.contains {
            $0.uuid != service?.uuid && $0.name.compare(trimmed, options: .caseInsensitive) == .orderedSame
        }
        guard !duplicate else {
            validationMessage = "Ya hay un servicio con ese nombre."
            return
        }

        if let service {
            let oldName = service.name
            service.name = trimmed
            renameInEvents(from: oldName, to: trimmed)
        } else {
            let created = CatalogService(name: trimmed)
            modelContext.insert(created)
            onCreated?(created)
        }
        try? modelContext.save()
        dismiss()
    }

    private func deleteService() {
        guard let service else { return }
        onDeleted?(service.uuid)
        modelContext.delete(service)
        try? modelContext.save()
        dismiss()
    }

    private func renameInEvents(from oldName: String, to newName: String) {
        guard oldName.compare(newName, options: .caseInsensitive) != .orderedSame else { return }
        for event in events {
            var names = event.listedServices
            var changed = false
            for index in names.indices where names[index].compare(oldName, options: .caseInsensitive) == .orderedSame {
                names[index] = newName
                changed = true
            }
            if changed {
                event.listedServices = names
            }
        }
    }
}

#Preview {
    ServiceEditorSheet()
        .modelContainer(PreviewSampleData.container)
}
