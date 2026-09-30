import SwiftData
import SwiftUI

struct AddEditEventView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \WorkEvent.startDate, order: .reverse) private var events: [WorkEvent]
    @Query(sort: \Company.name) private var companies: [Company]
    @Query(sort: \CatalogService.name) private var services: [CatalogService]

    let route: EventEditorRoute

    @State private var startDate: Date
    @State private var endDate: Date
    @State private var selectedServiceIds: Set<UUID> = []
    @State private var amount: Decimal
    @State private var amountPick: String
    @State private var paymentStatus: PaymentStatus
    @State private var notes: String
    @State private var activityName: String
    @State private var selectedCompanyId: UUID?
    @State private var showingCompanyEditor = false
    @State private var showingServiceEditor = false
    @State private var editingService: CatalogService?
    @State private var showingDeleteConfirm = false
    @State private var validationMessage: String?
    @State private var reminderKinds: Set<EventReminder.Kind> = []
    @State private var reminderTime: Date
    @State private var customReminders: [CustomReminderDraft] = []
    @State private var notifyDenied = false

    private var isEditing: Bool {
        if case .edit = route { return true }
        return false
    }

    init(route: EventEditorRoute) {
        self.route = route
        switch route {
        case .create(let day):
            _startDate = State(initialValue: Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: day.startOfDay) ?? day)
            _endDate = State(initialValue: Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: day.startOfDay) ?? day)
            _selectedServiceIds = State(initialValue: [])
            _amount = State(initialValue: 0)
            _amountPick = State(initialValue: "")
            _paymentStatus = State(initialValue: .pending)
            _notes = State(initialValue: "")
            _activityName = State(initialValue: "")
            _selectedCompanyId = State(initialValue: nil)
            _reminderTime = State(initialValue: Self.defaultReminderTime)
        case .edit(let event):
            _startDate = State(initialValue: event.startDate)
            _endDate = State(initialValue: event.endDate)
            _selectedServiceIds = State(initialValue: [])
            _amount = State(initialValue: event.amount)
            _amountPick = State(initialValue: Self.amountKey(event.amount))
            _paymentStatus = State(initialValue: event.paymentStatus)
            _notes = State(initialValue: event.notes)
            _activityName = State(initialValue: event.activityName)
            _selectedCompanyId = State(initialValue: event.company?.uuid)
            let existing = event.reminders
            _reminderKinds = State(initialValue: Set(existing.map(\.kind)))
            _reminderTime = State(initialValue: Self.timeDate(from: existing.first(where: { $0.kind != .custom })?.time))
            _customReminders = State(initialValue: existing.filter { $0.kind == .custom }.map {
                CustomReminderDraft(id: $0.id, date: $0.customAt ?? event.startDate)
            })
        }
    }

    private static var defaultReminderTime: Date {
        timeDate(from: EventReminder.defaultTime)
    }

    private static func timeDate(from value: String?) -> Date {
        let parts = (value ?? EventReminder.defaultTime).split(separator: ":")
        let hour = Int(parts.first ?? "8") ?? 8
        let minute = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
        return Calendar.current.date(from: DateComponents(hour: hour, minute: minute)) ?? .now
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Fechas y horario") {
                    DatePicker("Inicio", selection: $startDate, displayedComponents: .date)
                    DatePicker("Desde", selection: $startDate, displayedComponents: .hourAndMinute)
                    DatePicker("Fin", selection: $endDate, displayedComponents: .date)
                    DatePicker("Hasta", selection: $endDate, displayedComponents: .hourAndMinute)
                    if Calendar.current.inclusiveDayCount(from: startDate, to: endDate) > 1 {
                        Text("Evento de \(Calendar.current.inclusiveDayCount(from: startDate, to: endDate)) días seguidos")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Actividad") {
                    TextField("Nombre de la actividad", text: $activityName)
                    Text("Opcional. Ej. concierto, boda, festival. Si lo dejas vacío se usan los servicios.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Servicios") {
                    Text("Puedes marcar varios. El monto es por día y se multiplica si eliges más de un día.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ForEach(services) { service in
                        HStack {
                            Toggle(service.name, isOn: serviceToggle(service.uuid))
                            Button {
                                editingService = service
                                showingServiceEditor = true
                            } label: {
                                Image(systemName: "pencil.circle")
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel("Editar \(service.name)")
                        }
                    }
                    Button("Nuevo servicio", systemImage: "plus") {
                        editingService = nil
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
                    if !listedAmounts.isEmpty {
                        Picker("Monto por día", selection: $amountPick) {
                            Text("").tag("")
                            ForEach(listedAmounts, id: \.self) { value in
                                Text("RD$ \(CurrencyFormat.plainString(from: value))").tag(Self.amountKey(value))
                            }
                            Text("Otro monto…").tag("__other")
                        }
                        .onChange(of: amountPick) { _, key in
                            applyAmountPick(key)
                        }
                    }
                    if listedAmounts.isEmpty || amountPick == "__other" {
                        HStack {
                            Text("RD$")
                                .fontWeight(.bold)
                                .foregroundStyle(Color.accentColor)
                            TextField(
                                listedAmounts.isEmpty ? "Monto por día" : "Otro monto",
                                value: $amount,
                                format: .number.precision(.fractionLength(0...2))
                            )
                            .keyboardType(.decimalPad)
                        }
                    }
                    if Calendar.current.inclusiveDayCount(from: startDate, to: endDate) > 1 {
                        Text("Total a cobrar: \(CurrencyFormat.string(from: amount * Decimal(Calendar.current.inclusiveDayCount(from: startDate, to: endDate))))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

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

                Section("Recordatorios") {
                    Toggle("El mismo día", isOn: reminderKindToggle(.sameDay))
                    Toggle("1 día antes", isOn: reminderKindToggle(.dayBefore))
                    Toggle("2 días antes", isOn: reminderKindToggle(.twoDaysBefore))
                    if reminderKinds.contains(.sameDay)
                        || reminderKinds.contains(.dayBefore)
                        || reminderKinds.contains(.twoDaysBefore) {
                        DatePicker("Hora del aviso", selection: $reminderTime, displayedComponents: .hourAndMinute)
                    }
                    Toggle("Fecha y hora personalizada", isOn: reminderKindToggle(.custom))
                    if reminderKinds.contains(.custom) {
                        ForEach($customReminders) { $item in
                            DatePicker("Aviso", selection: $item.date, displayedComponents: [.date, .hourAndMinute])
                        }
                        Button("Otra fecha y hora", systemImage: "plus") {
                            customReminders.append(CustomReminderDraft(date: dateWithReminderTime(startDate)))
                        }
                    }
                    if notifyDenied {
                        Text("Sin permiso no llegan avisos. Puedes activarlos en Ajustes. El trabajo se guarda igual.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    } else {
                        Text("En iPhone el aviso puede llegar aunque la app esté cerrada, si aceptas notificaciones.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
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
                    Button("Guardar") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                }
            }
            .onChange(of: startDate) { _, newValue in
                if endDate < newValue {
                    endDate = newValue
                }
            }
            .onAppear {
                syncServiceSelection()
                if isEditing { syncAmountPick() }
                if !reminderKinds.isEmpty {
                    Task { notifyDenied = await EventReminderScheduler.permissionDenied() }
                }
            }
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
            .sheet(isPresented: $showingServiceEditor, onDismiss: { editingService = nil }) {
                ServiceEditorSheet(
                    service: editingService,
                    onCreated: { created in
                        selectedServiceIds.insert(created.uuid)
                    },
                    onDeleted: { id in
                        selectedServiceIds.remove(id)
                    }
                )
            }
        }
    }

    private var selectedCompany: Company? {
        companies.first { $0.uuid == selectedCompanyId }
    }

    private var listedAmounts: [Decimal] {
        CurrencyFormat.uniqued(CurrencyFormat.savedAmounts + events.map(\.amount))
    }

    private static func amountKey(_ amount: Decimal) -> String {
        (amount as NSDecimalNumber).stringValue
    }

    private func applyAmountPick(_ key: String) {
        if key.isEmpty {
            amount = 0
            return
        }
        if key == "__other" {
            amount = 0
            return
        }
        amount = Decimal(string: key) ?? 0
    }

    private func syncAmountPick() {
        let key = Self.amountKey(amount)
        if listedAmounts.contains(where: { Self.amountKey($0) == key }) {
            amountPick = key
        } else {
            amountPick = "__other"
        }
    }

    private var selectedServiceNames: [String] {
        services
            .filter { selectedServiceIds.contains($0.uuid) }
            .map(\.name)
    }

    private func reminderKindToggle(_ kind: EventReminder.Kind) -> Binding<Bool> {
        Binding(
            get: { reminderKinds.contains(kind) },
            set: { isOn in
                if isOn {
                    reminderKinds.insert(kind)
                    if kind == .custom && customReminders.isEmpty {
                        customReminders.append(CustomReminderDraft(date: dateWithReminderTime(startDate)))
                    }
                    Task { await askNotificationPermission() }
                } else {
                    reminderKinds.remove(kind)
                    if kind == .custom { customReminders = [] }
                }
            }
        )
    }

    private func askNotificationPermission() async {
        let granted = await EventReminderScheduler.requestPermission()
        notifyDenied = !granted || (await EventReminderScheduler.permissionDenied())
    }

    private func timeString(from date: Date) -> String {
        let hour = Calendar.current.component(.hour, from: date)
        let minute = Calendar.current.component(.minute, from: date)
        return String(format: "%02d:%02d", hour, minute)
    }

    private func collectedReminders(from previous: [EventReminder]) -> [EventReminder] {
        var result: [EventReminder] = []
        let time = timeString(from: reminderTime)
        for kind in [EventReminder.Kind.sameDay, .dayBefore, .twoDaysBefore] where reminderKinds.contains(kind) {
            let prev = previous.first { $0.kind == kind }
            result.append(EventReminder(
                id: prev?.id ?? UUID(),
                kind: kind,
                time: time,
                customAt: nil,
                notifiedAt: prev?.time == time ? prev?.notifiedAt : nil
            ))
        }
        if reminderKinds.contains(.custom) {
            for item in customReminders {
                let prev = previous.first { $0.id == item.id }
                    ?? previous.first { $0.kind == .custom && $0.customAt == item.date }
                result.append(EventReminder(
                    id: item.id,
                    kind: .custom,
                    time: "",
                    customAt: item.date,
                    notifiedAt: prev?.customAt == item.date ? prev?.notifiedAt : nil
                ))
            }
        }
        return result
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

    private func dateWithReminderTime(_ day: Date) -> Date {
        let hour = Calendar.current.component(.hour, from: reminderTime)
        let minute = Calendar.current.component(.minute, from: reminderTime)
        return Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
    }

    private func save() async {
        let names = selectedServiceNames
        guard !names.isEmpty else {
            validationMessage = "Selecciona uno o más servicios."
            return
        }
        guard let selectedCompany else {
            validationMessage = "Selecciona o crea la empresa contratante."
            return
        }
        if !listedAmounts.isEmpty && amountPick.isEmpty {
            validationMessage = "Selecciona o escribe el monto."
            return
        }
        guard amount >= 0 else {
            validationMessage = "El monto no puede ser negativo."
            return
        }
        if Calendar.current.startOfDay(for: endDate) < Calendar.current.startOfDay(for: startDate) {
            validationMessage = "La fecha de fin no puede ser antes del inicio."
            return
        }
        if Calendar.current.isDate(startDate, inSameDayAs: endDate), endDate <= startDate {
            validationMessage = "La hora de fin debe ser después de la de inicio."
            return
        }

        let previous: [EventReminder]
        if case .edit(let event) = route {
            previous = event.reminders
        } else {
            previous = []
        }
        let reminders = collectedReminders(from: previous)
        if !reminders.isEmpty {
            await askNotificationPermission()
        }

        switch route {
        case .create:
            let event = WorkEvent(
                startDate: startDate,
                endDate: endDate,
                projectName: names.joined(separator: ", "),
                amount: amount,
                paymentStatus: paymentStatus,
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
                activityName: activityName,
                company: selectedCompany,
                serviceNames: names,
                reminders: reminders
            )
            modelContext.insert(event)
            EventReminderScheduler.reschedule(event: event)
        case .edit(let event):
            event.startDate = startDate
            event.endDate = endDate
            event.listedServices = names
            event.amount = amount
            event.paymentStatus = paymentStatus
            event.notes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
            event.activityName = activityName.trimmingCharacters(in: .whitespacesAndNewlines)
            event.company = selectedCompany
            event.reminders = reminders
            EventReminderScheduler.reschedule(event: event)
        }

        if amount > 0 {
            CurrencyFormat.remember(amount)
        }
        try? modelContext.save()
        dismiss()
    }

    private func deleteEvent() {
        if case .edit(let event) = route {
            EventReminderScheduler.cancel(eventId: event.uuid)
            modelContext.delete(event)
            try? modelContext.save()
        }
        dismiss()
    }
}

private struct CustomReminderDraft: Identifiable, Equatable {
    var id: UUID = UUID()
    var date: Date
}

#Preview("Nuevo") {
    AddEditEventView(route: .create(day: .now))
        .modelContainer(PreviewSampleData.container)
}
