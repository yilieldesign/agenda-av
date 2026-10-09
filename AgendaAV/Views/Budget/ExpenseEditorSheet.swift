import SwiftData
import SwiftUI

struct ExpenseEditorSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let expense: FixedExpense?
    let defaultMonth: Date

    @State private var entity: String
    @State private var name: String
    @State private var amount: Decimal
    @State private var dueDay: Int
    @State private var monthDate: Date
    @State private var oneTime: Bool
    @State private var notes: String
    @State private var validationMessage: String?
    @State private var showingDeleteConfirm = false

    init(expense: FixedExpense? = nil, defaultMonth: Date = .now) {
        self.expense = expense
        self.defaultMonth = defaultMonth
        let values = FixedExpense.formValues(from: expense)
        _entity = State(initialValue: values.entity)
        _name = State(initialValue: values.name)
        _amount = State(initialValue: expense?.amount ?? 0)
        _dueDay = State(initialValue: expense?.dueDay ?? 1)
        _monthDate = State(initialValue: expense?.startMonthDate ?? Calendar.current.startOfMonth(for: defaultMonth))
        _oneTime = State(initialValue: expense?.oneTime ?? false)
        _notes = State(initialValue: expense?.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Entidad", text: $entity)
                    TextField("Título", text: $name)
                    HStack {
                        Text("RD$")
                            .fontWeight(.bold)
                            .foregroundStyle(Color.accentColor)
                        TextField("Monto del mes", value: $amount, format: .number.precision(.fractionLength(0...2)))
                            .keyboardType(.decimalPad)
                    }
                    DatePicker("Mes", selection: $monthDate, displayedComponents: [.month, .year])
                        .environment(\.locale, Locale(identifier: "es_DO"))
                    Toggle("Solo este mes", isOn: $oneTime)
                    Picker("Día de pago", selection: $dueDay) {
                        ForEach(1...31, id: \.self) { day in
                            Text("\(day)").tag(day)
                        }
                    }
                    Text("La entidad sirve para agrupar (Claro, Edesur…). El título es qué estás pagando (mi renta, renta mami). El mes dice desde cuándo sale; si marcas Solo este mes, no se repite.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Notas") {
                    TextField("Opcional", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                }

                if expense != nil {
                    Section {
                        Button("Eliminar gasto", role: .destructive) {
                            showingDeleteConfirm = true
                        }
                    }
                }
            }
            .navigationTitle(expense == nil ? "Nuevo gasto fijo" : "Editar gasto fijo")
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
            .alert("¿Eliminar este gasto fijo?", isPresented: $showingDeleteConfirm) {
                Button("Eliminar", role: .destructive, action: deleteExpense)
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text(expense?.oneTime == true ? "Deja de salir en este mes." : "Deja de salir en todos los meses.")
            }
        }
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEntity = entity.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            validationMessage = "Escribe el título del gasto."
            return
        }
        guard amount > 0 else {
            validationMessage = "Escribe el monto del mes."
            return
        }
        let monthKey = FixedExpense.monthKey(monthDate)
        if let expense {
            expense.entity = trimmedEntity
            expense.name = trimmedName
            expense.amount = amount
            expense.dueDay = dueDay
            expense.startMonth = monthKey
            expense.oneTime = oneTime
            expense.notes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            modelContext.insert(FixedExpense(
                entity: trimmedEntity,
                name: trimmedName,
                amount: amount,
                dueDay: dueDay,
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines),
                startMonth: monthKey,
                oneTime: oneTime
            ))
        }
        try? modelContext.save()
        dismiss()
    }

    private func deleteExpense() {
        if let expense {
            modelContext.delete(expense)
            try? modelContext.save()
        }
        dismiss()
    }
}
