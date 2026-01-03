sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "ordermanagement/ordermanagement/controller/util/ExportPDF",
    "ordermanagement/ordermanagement/model/formatter"
], (Controller, JSONModel, ExportPDF, formatter) => {
    "use strict";

    return Controller.extend("ordermanagement.ordermanagement.controller.PaymentSuccess", {
        formatter,

        onInit() {
            this._exportPdf = new ExportPDF(this);
            const successModel = new JSONModel({
                orderId: "",
                method: "",
                amount: 0
            });
            this.getView().setModel(successModel, "success");

            const router = this.getOwnerComponent().getRouter();
            router.getRoute("RoutePaymentSuccess").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched(event) {
            const args = event.getParameter("arguments") || {};
            const orderId = args.orderId;
            const method = args.method || "";
            if (!orderId) {
                return;
            }
            const successModel = this.getView().getModel("success");
            successModel.setProperty("/orderId", orderId);
            successModel.setProperty("/method", method);
            this._bindOrder(orderId);
            this._loadOrderData(orderId, method);
        },

        _bindOrder(orderId) {
            const path = this._buildOrderPath(orderId);
            this.getView().bindElement({
                path,
                parameters: {
                    $expand: "items($expand=item),customer($expand=country)",
                    $select: "ID,date,status"
                }
            });
        },

        _loadOrderData(orderId, method) {
            const model = this.getOwnerComponent().getModel();
            const path = this._buildOrderPath(orderId);
            const binding = model.bindContext(path, undefined, {
                $expand: "customer($select=firstName,lastName,email,phone,address,postalCode,country_ID;$expand=country($select=name)),items($expand=item)"
            });

            binding.requestObject().then((data) => {
                this._applyOrderData(orderId, method, data);
            }).catch(() => {
                this._applyOrderData(orderId, method, {});
            });
        },

        _applyOrderData(orderId, method, data) {
            const successModel = this.getView().getModel("success");
            const items = Array.isArray(data.items) ? data.items : [];
            const computedAmount = items.reduce((sum, item) => {
                const qty = Number(item.quantity);
                const price = Number(item.unitPrice);
                if (!Number.isFinite(qty) || !Number.isFinite(price)) {
                    return sum;
                }
                return sum + (qty * price);
            }, 0);
            const resolvedAmount = this._resolveAmount(computedAmount, data.total, data.totalAmount);
            successModel.setData({
                orderId,
                method,
                amount: resolvedAmount
            });
        },

        _resolveAmount(computedAmount, total, totalAmount) {
            const parsedTotal = Number(total);
            const parsedTotalAmount = Number(totalAmount);
            if (Number.isFinite(computedAmount) && computedAmount > 0) {
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

        onDownloadInvoice() {
            if (this._exportPdf) {
                this._exportPdf.download();
            }
        },

        formatAmount(value) {
            return formatter.formatAmount(value);
        }
    });
});
