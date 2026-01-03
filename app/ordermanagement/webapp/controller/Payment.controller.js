sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History",
    "ordermanagement/ordermanagement/model/formatter"
], (Controller, JSONModel, MessageToast, History, formatter) => {
    "use strict";

    return Controller.extend("ordermanagement.ordermanagement.controller.Payment", {
        formatter,

        onInit() {
            const paymentModel = new JSONModel({
                orderId: "",
                orderDate: null,
                status: "",
                amount: 0,
                paymentMethod: "",
                customer: {
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: "",
                    address: "",
                    postalCode: "",
                    country: ""
                },
                card: {
                    holder: "",
                    number: "",
                    expiry: "",
                    cvc: ""
                },
                notes: ""
            });
            this.getView().setModel(paymentModel, "payment");

            const router = this.getOwnerComponent().getRouter();
            router.getRoute("RoutePayment").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(event) {
            const orderId = event.getParameter("arguments").orderId;
            if (!orderId) {
                return;
            }
            this._bindOrder(orderId);
            this._loadOrderData(orderId);
        },

        _bindOrder(orderId) {
            const path = this._buildOrderPath(orderId);
            this.getView().bindElement({
                path,
                parameters: {
                    $expand: "items($expand=item)"
                }
            });
        },

        _loadOrderData(orderId) {
            const model = this.getOwnerComponent().getModel();
            const path = this._buildOrderPath(orderId);
            const binding = model.bindContext(path, undefined, {
                $expand: "customer($select=firstName,lastName,email,phone,address,postalCode,country_ID;$expand=country($select=name)),items($expand=item)"
            });

            binding.requestObject().then((data) => {
                this._applyOrderData(orderId, data);
            }).catch(() => {
                this._applyOrderData(orderId, {});
            });
        },

        _applyOrderData(orderId, data) {
            const paymentModel = this.getView().getModel("payment");
            const currentMethod = paymentModel.getProperty("/paymentMethod") || "";
            const customer = data.customer || {};
            const items = Array.isArray(data.items) ? data.items : [];

            const computedAmount = items.reduce((sum, item) => {
                const qty = Number(item.quantity);
                const price = Number(item.unitPrice);
                if (!Number.isFinite(qty) || !Number.isFinite(price)) {
                    return sum;
                }
                return sum + (qty * price);
            }, 0);
            const totalValue = this._resolveAmount(computedAmount, data.total, data.totalAmount);

            paymentModel.setData({
                orderId,
                orderDate: data.date || null,
                status: data.status || "",
                amount: totalValue,
                paymentMethod: currentMethod,
                customer: {
                    firstName: customer.firstName || "",
                    lastName: customer.lastName || "",
                    email: customer.email || "",
                    phone: customer.phone || "",
                    address: customer.address || "",
                    postalCode: customer.postalCode || "",
                    country: (customer.country && customer.country.name) || ""
                },
                card: {
                    holder: "",
                    number: "",
                    expiry: "",
                    cvc: ""
                },
                notes: ""
            });
        },

        _resolveAmount(computedAmount, total, totalAmount) {
            const parsedTotal = Number(total);
            const parsedTotalAmount = Number(totalAmount);
            if (Number.isFinite(computedAmount)) {
                return computedAmount;
            }
            if (Number.isFinite(parsedTotal)) {
                return parsedTotal;
            }
            if (Number.isFinite(parsedTotalAmount)) {
                return parsedTotalAmount;
            }
            return 0;
        },

        _buildOrderPath(orderId) {
            return `/Orders('${orderId}')`;
        },

        onNavBack() {
            const history = History.getInstance();
            const previousHash = history.getPreviousHash();
            if (previousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteOrderManagement", {}, true);
            }
        },

        async onSimulatePayment() {
            const model = this.getView().getModel("payment");
            const orderId = model && model.getProperty("/orderId");
            const method = model && model.getProperty("/paymentMethod");
            if (!orderId) {
                MessageToast.show("Select an order before proceeding.");
                return;
            }
            if (!method) {
                MessageToast.show("Choose a payment method to continue.");
                return;
            }
            await this._markOrderAsPaid();
            this.getOwnerComponent().getRouter().navTo("RoutePaymentSuccess", {
                orderId,
                method
            });
        },

        async _markOrderAsPaid() {
            const ctxBinding = this.getView().getElementBinding();
            const context = ctxBinding && ctxBinding.getBoundContext && ctxBinding.getBoundContext();
            if (!context || !context.setProperty) {
                return;
            }
            context.setProperty("status", "Paid");
            const mainModel = this.getOwnerComponent().getModel();
            try {
                await mainModel.submitBatch("$auto");
                const paymentModel = this.getView().getModel("payment");
                if (paymentModel) {
                    paymentModel.setProperty("/status", "Paid");
                }
            } catch (_e) {
                MessageToast.show("Failed to update order status.");
            }
        },

        onSelectPaymentMethod(event) {
            const item = event.getParameter("listItem");
            const method = item && item.data("paymentMethod");
            if (!method) {
                return;
            }
            const model = this.getView().getModel("payment");
            model.setProperty("/paymentMethod", method);
        },

        calculateItemTotal(quantity, unitPrice) {
            return formatter.calculateItemTotal(quantity, unitPrice);
        },

        formatDate(value) {
            return formatter.formatDate(value);
        },

        formatAmount(value) {
            return formatter.formatAmount(value);
        },

        formatStatusState(value) {
            return formatter.formatStatusState(value);
        }
    });
});
