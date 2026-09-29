import SwiftData
import SwiftUI

struct AddEditEventView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Company.name) private var companies: [Company]
    @Query(sort: \CatalogService.name) private var services: [CatalogService]

    let route: EventEditorRoute

    @State private var startDate: Date
    @State private var endDate: Date
    @State private var selectedServiceIds: Set<UUID> = []
    @State private var amount: Decimal
    @State private var paymentStatus: PaymentStatus
    @State private var notes: String
    @State private var selectedCompanyId: UUID?
    @State private var showingCompanyEditor = false
    @State private var showingServiceEditor = false
    @State private var showingDeleteConfirm = false
    @State private var validationMessage: String?

    private var isEditing: Bool {
        if case .edit = route { return true }
        return false
    }

    init(route: EventEditorRoute) {
        self.route = route
        switch route {
        case .create(let day):
            _startDate = State(initialValue: day.startOfDay)
            _endDate = State(initialValue: day.startOfDay)
            _selectedServiceIds = State(initialValue: [])
            _amount = State(initialValue: 0)
            _paymentStatus = State(initialValue: .pending)
            _notes = State(initialValue: "")
            _selectedCompanyId = State(initialValue: nil)
        case .edit(let event):
            _startDate = State(initialValue: event.startDate)
            _endDate = State(initialValue: event.endDate)
            _selectedServiceIds = State(initialValue: [])
            _amount = State(initialValue: event.amount)
            _paymentStatus = State(initialValue: event.paymentStatus)
            _notes = State(initialValue: event.notes)
            _selectedCompanyId = State(initialValue: event.company?.uuid)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Fechas") {
                    DatePicker("Inicio", selection: $startDate, displayedComponents: .date)
                    DatePicker("Fin", selection: $endDate, in: startDate..., displayedComponents: .date)
                    if Calendar.current.inclusiveDayCount(from: startDate, to: endDate) > 1 {
                        Text("Evento de \(Calendar.current.inclusiveDayCount(from: startDate, to: endDate)) días seguidos")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Servicios") {
                    Text("Puedes marcar varios. El monto es uno solo para este trabajo.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ForEach(services) { service in
                        Toggle(service.name, isOn: serviceToggle(service.uuid))
                    }
                    Button("Nuevo servicio", systemImage: "plus") {
                        showingServiceEditor = true
                    }

                    Picker("Empresa / cliente", selection: $selectedCompanyId) {
                        Text("Selecciona una empresa").tag(Optional<UUID>.none)
                        ForEach(companies) { company in
                            Text(company.name).tag(Optional(company.uuid))
                        }
                    }
                    Button("Nueva empresa", systemImage: "plus") {
                        showingCompanyEditor = true
                    }
                }

                Section("Cobro") {
                    TextField(
                        "Monto a cobrar",
                        value: $amount,
                        format: .currency(code: CurrencyFormat.code)
                    )
                    .keyboardType(.decimalPad)

                    Picker("Estado del pago", selection: $paymentStatus) {
                        ForEach(PaymentStatus.allCases) { status in
                            Text(status.title).tag(status)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Notas") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 88)
                    Text("Rol, lugar, equipamiento u otros detalles.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if isEditing {
                    Section {
                        Button("Eliminar trabajo", role: .destructive) {
                            showingDeleteConfirm = true
                        }
                    }
                }
            }
            .navigationTitle(isEditing ? "Editar trabajo" : "Nuevo trabajo")
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
            .onChange(of: startDate) { _, newValue in
                if endDate < newValue {
                    endDate = newValue
                }
            }
            .onAppear(perform: syncServiceSelection)
            .onChange(of: services.count) { _, _ in
                syncServiceSelection()
            }
            .alert("Revisa el formulario", isPresented: Binding(
                get: { validationMessage != nil },
                set: { if !$0 { validationMessage = nil } }
            )) {
                Button("OK", role: .cancel) { validationMessage = nil }
            } message: {
                Text(validationMessage ?? "")
            }
            .alert("¿Eliminar este trabajo?", isPresented: $showingDeleteConfirm) {
                Button("Eliminar", role: .destructive, action: deleteEvent)
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Esta acción no se puede deshacer.")
            }
            .sheet(isPresented: $showingCompanyEditor) {
                CompanyEditorSheet(
                    company: nil,
                    usedHexes: companies.map(\.colorHex)
                ) { created in
                    selectedCompanyId = created.uuid
                }
            }
            .sheet(isPresented: $showingServiceEditor) {
                ServiceEditorSheet { created in
                    selectedServiceIds.insert(created.uuid)
                }
            }
        }
    }

    private var selectedCompany: Company? {
        companies.first { $0.uuid == selectedCompanyId }
    }

    private var selectedServiceNames: [String] {
        services
            .filter { selectedServiceIds.contains($0.uuid) }
            .map(\.name)
    }

    private func serviceToggle(_ id: UUID) -> Binding<Bool> {
        Binding(
            get: { selectedServiceIds.contains(id) },
            set: { isOn in
                if isOn {
                    selectedServiceIds.insert(id)
                } else {
                    selectedServiceIds.remove(id)
                }
            }
        )
    }

    private func syncServiceSelection() {
        guard selectedServiceIds.isEmpty, case .edit(let event) = route else { return }
        var ids = Set<UUID>()
        for name in event.listedServices {
            if let match = services.first(where: { $0.name.compare(name, options: .caseInsensitive) == .orderedSame }) {
                ids.insert(match.uuid)
            } else {
                let created = CatalogService(name: name)
                modelContext.insert(created)
                ids.insert(created.uuid)
            }
        }
        selectedServiceIds = ids
    }

    private func save() {
        let names = selectedServiceNames
        guard !names.isEmpty else {
            validationMessage = "Selecciona uno o más servicios."
            return
        }
        guard let selectedCompany else {
            validationMessage = "Selecciona o crea la empresa contratante."
            return
        }
        guard amount >= 0 else {
            validationMessage = "El monto no puede ser negativo."
            return
        }

        switch route {
        case .create:
            let event = WorkEvent(
                startDate: startDate.startOfDay,
                endDate: endDate.startOfDay,
                projectName: names.joined(separator: ", "),
                amount: amount,
                paymentStatus: paymentStatus,
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
                company: selectedCompany,
                serviceNames: names
            )
            modelContext.insert(event)
        case .edit(let event):
            event.startDate = startDate.startOfDay
            event.endDate = endDate.startOfDay
            event.listedServices = names
            event.amount = amount
            event.paymentStatus = paymentStatus
            event.notes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
            event.company = selectedCompany
        }

        try? modelContext.save()
        dismiss()
    }

    private func deleteEvent() {
        if case .edit(let event) = route {
            modelContext.delete(event)
            try? modelContext.save()
        }
        dismiss()
    }
}

#Preview("Nuevo") {
    AddEditEventView(route: .create(day: .now))
        .modelContainer(PreviewSampleData.container)
}
