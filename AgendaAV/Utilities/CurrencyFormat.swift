import Foundation

enum CurrencyFormat {
    static let lastAmountKey = "agendaAV.lastDailyAmount"

    /// Código ISO de la moneda (pesos dominicanos).
    static var code: String { "DOP" }

    static var lastAmount: Decimal {
        get { Decimal(UserDefaults.standard.double(forKey: lastAmountKey)) }
        set { UserDefaults.standard.set((newValue as NSDecimalNumber).doubleValue, forKey: lastAmountKey) }
    }

    static func string(from amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.currencySymbol = "RD$"
        formatter.locale = Locale(identifier: "es_DO")
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: amount as NSDecimalNumber) ?? "RD$\(amount)"
    }
}
