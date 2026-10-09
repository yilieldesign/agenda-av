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
    @State private var payCycle: PayCycle
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
        _payCycle = State(initialValue: company?.payCycle ?? .fifteenthAndMonthEnd)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Empresa / cliente") {
                    TextField("Nombre", text: $name)
                    ColorPicker("Color en el calendario", selection: $color, supportsOpacity: false)
                    Picker("Cuándo te pagan", selection: $payCycle) {
                        ForEach(PayCycle.allCases) { cycle in
                            Text(cycle.title).tag(cycle)
                        }
                    }
                    Text("Si paga solo el 30, esos trabajos no salen en la quincena del 1 al 15; aparecen del 16 al fin de mes.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
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
        .presentationDetents([.medium, .large])
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
            company.payCycle = payCycle
        } else {
            let created = Company(name: trimmed, colorHex: hex, payCycle: payCycle)
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
