import SwiftData
import SwiftUI

struct CompanyEditorSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let company: Company?
    let usedHexes: [String]
    var onCreated: ((Company) -> Void)?

    @State private var name: String
    @State private var color: Color
    @State private var validationMessage: String?

    init(
        company: Company?,
        usedHexes: [String],
        onCreated: ((Company) -> Void)? = nil
    ) {
        self.company = company
        self.usedHexes = usedHexes
        self.onCreated = onCreated
        _name = State(initialValue: company?.name ?? "")
        _color = State(initialValue: company?.color ?? Color(hex: CompanyColorPalette.nextUnused(from: usedHexes)))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Empresa / cliente") {
                    TextField("Nombre", text: $name)
                    ColorPicker("Color en el calendario", selection: $color, supportsOpacity: false)
                    HStack {
                        Text("Vista previa")
                        Spacer()
                        Circle()
                            .fill(color)
                            .frame(width: 22, height: 22)
                            .overlay(Circle().strokeBorder(.black.opacity(0.1)))
                    }
                }
            }
            .navigationTitle(company == nil ? "Nueva empresa" : "Editar empresa")
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
            validationMessage = "Escribe el nombre de la empresa."
            return
        }

        let hex = color.toHex()
        if let company {
            company.name = trimmed
            company.colorHex = hex
        } else {
            let created = Company(name: trimmed, colorHex: hex)
            modelContext.insert(created)
            onCreated?(created)
        }
        try? modelContext.save()
        dismiss()
    }
}

#Preview {
    CompanyEditorSheet(company: nil, usedHexes: [])
        .modelContainer(PreviewSampleData.container)
}
