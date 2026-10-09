import SwiftData
import SwiftUI

struct ExpenseEditorSheet: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let expense: FixedExpense?

    @State private var name: String
    @State private var amount: Decimal
    @State private var dueDay: Int
    @State private var notes: String
    @State private var validationMessage: String?
    @State private var showingDeleteConfirm = false

    init(expense: FixedExpense? = nil) {
        self.expense = expense
        _name = State(initialValue: expense?.name ?? "")
        _amount = State(initialValue: expense?.amount ?? 0)
        _dueDay = State(initialValue: expense?.dueDay ?? 1)
        _notes = State(initialValue: expense?.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Nombre", text: $name)
                    HStack {
                        Text("RD$")
                            .fontWeight(.bold)
                            .foregroundStyle(Color.accentColor)
                        TextField("Monto del mes", value: $amount, format: .number.precision(.fractionLength(0...2)))
                            .keyboardType(.decimalPad)
                    }
                    Picker("Día de pago", selection: $dueDay) {
                        ForEach(1...31, id: \.self) { day in
                            Text("\(day)").tag(day)
                        }
                    }
                    Text("Sale todos los meses. En Presupuesto marcas si este mes ya lo pagaste.")
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
                Text("Deja de salir en todos los meses.")
            }
        }
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            validationMessage = "Escribe el nombre del gasto."
            return
        }
        guard amount > 0 else {
            validationMessage = "Escribe el monto del mes."
            return
        }
        if let expense {
            expense.name = trimmed
            expense.amount = amount
            expense.dueDay = dueDay
            expense.notes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            modelContext.insert(FixedExpense(
                name: trimmed,
                amount: amount,
                dueDay: dueDay,
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)
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
