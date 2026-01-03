sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "ordermanagement/ordermanagement/model/formatter"
], (JSONModel, Fragment, Filter, FilterOperator, MessageBox, MessageToast, formatter) => {
    "use strict";

    class CreateOrder {
        constructor(controller, typeOptions) {
            this.controller = controller;
            this.typeOptions = Array.isArray(typeOptions) ? typeOptions : [];
            this._orderWizardPromise = null;
            this._orderWizardModel = null;
            this._wizardItemsBinding = null;
            this._itemContextMap = {};
        }

        async open() {
            this._resetWizardModel();
            const dialog = await this._loadOrderWizard();
            dialog.setBusy(false);
            dialog.open();
            const wizard = this._getWizard();
            if (wizard) {
                const steps = wizard.getSteps();
                if (steps && steps.length > 0) {
                    wizard.discardProgress(steps[0]);
                    wizard.goToStep(this.controller.byId("wizardCustomerStep"));
                }
            }
            await Promise.all([this._loadCustomers(), this._loadCountries()]);
            this._updateSummary();
            this._validateWizardState();
        }

        close() {
            this._loadOrderWizard().then((dialog) => {
                dialog.close();
            });
        }

        handleCustomerModeChange(event) {
            const key = event.getParameter("key") || event.getSource().getSelectedKey();
            const mode = key || "existing";
            const model = this._getOrderWizardModel();
            model.setProperty("/customerMode", mode);
            if (mode === "existing") {
                model.setProperty("/newCustomer", this._getWizardDefaults().newCustomer);
            } else {
                model.setProperty("/customerId", "");
            }
            this._updateCustomerSelection();
            this._updateSummary();
            this._validateWizardState();
        }

        handleNewCustomerChange() {
            this._updateSummary();
            this._validateWizardState();
        }

        handleCustomerSearch(event) {
            const search = event.getParameter("newValue") || "";
            this._getOrderWizardModel().setProperty("/customerSearch", search);
            this._applyCustomerFilter();
        }

        handleSelectCustomer(event) {
            const listItem = event.getParameter("listItem");
            const context = listItem && listItem.getBindingContext("wizard");
            const id = context ? context.getProperty("ID") : "";
            this._getOrderWizardModel().setProperty("/customerId", id);
            this._updateCustomerSelection();
            this._updateSummary();
            this._validateWizardState();
        }

        handleOrderTypeChange(event) {
            const type = event.getSource().getSelectedKey();
            this._getOrderWizardModel().setProperty("/orderType", type);
            this._loadItemsForType(type).then(() => {
                this._updateSummary();
                this._validateWizardState();
            });
        }

        handleOrderDateChange(event) {
            const dateValue = event.getParameter("value");
            const model = this._getOrderWizardModel();
            const finalValue = dateValue || this._getTodayDateString();
            model.setProperty("/orderDate", finalValue);
            this._updateSummary();
            this._validateWizardState();
        }

        handleItemQuantityChange(event) {
            const source = event.getSource();
            const context = source && source.getBindingContext("wizard");
            if (!context) {
                return;
            }
            const path = context.getPath();
            const stock = context.getProperty("stock") || 0;
            const value = Number(event.getParameter("value"));
            const finalValue = Number.isFinite(value) ? Math.max(0, Math.min(stock, value)) : 0;
            context.getModel().setProperty(`${path}/selectedQuantity`, finalValue);
            this._syncSelectedItems();
        }

        continueFromCustomer() {
            const validations = this._getOrderWizardModel().getProperty("/validations");
            if (!validations.customer) {
                MessageBox.error("Select or add a customer to continue.");
                return;
            }
            const wizard = this._getWizard();
            if (wizard) {
                wizard.nextStep();
            }
        }

        continueFromType() {
            const validations = this._getOrderWizardModel().getProperty("/validations");
            if (!validations.type) {
                MessageBox.error("Choose an order type to continue.");
                return;
            }
            const wizard = this._getWizard();
            if (wizard) {
                wizard.nextStep();
            }
        }

        continueFromItems() {
            const validations = this._getOrderWizardModel().getProperty("/validations");
            if (!validations.items) {
                MessageBox.error("Add at least one available item with a quantity above zero.");
                return;
            }
            this._updateSummary();
            const wizard = this._getWizard();
            if (wizard) {
                wizard.nextStep();
            }
        }

        async confirmOrder() {
            const validations = this._getOrderWizardModel().getProperty("/validations");
            if (!validations.customer || !validations.type || !validations.items) {
                MessageBox.error("Complete all steps before confirming the order.");
                return;
            }
            await this._submitOrder();
        }

        _getOrderWizardModel() {
            if (!this._orderWizardModel) {
                this._orderWizardModel = new JSONModel(this._getWizardDefaults());
            }
            return this._orderWizardModel;
        }

        _getWizardDefaults() {
            return {
                customerMode: "existing",
                customerId: "",
                customers: [],
                customerSearch: "",
                countries: [],
                orderType: "",
                items: [],
                selectedItems: [],
                summary: {
                    itemCount: 0,
                    total: 0,
                    customerLabel: "Not selected"
                },
                orderDate: this._getTodayDateString(),
                validations: {
                    customer: false,
                    type: false,
                    items: false
                },
                newCustomer: {
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: "",
                    country_ID: "",
                    address: "",
                    postalCode: ""
                }
            };
        }

        _resetWizardModel() {
            this._getOrderWizardModel().setData(this._getWizardDefaults());
        }

        _loadOrderWizard() {
            if (!this._orderWizardPromise) {
                this._orderWizardPromise = Fragment.load({
                    id: this.controller.getView().getId(),
                    name: "ordermanagement.ordermanagement.fragment.OrderWizard",
                    controller: this.controller
                }).then((dialog) => {
                    this.controller.getView().addDependent(dialog);
                    dialog.setModel(this._getOrderWizardModel(), "wizard");
                    return dialog;
                });
            }
            return this._orderWizardPromise;
        }

        async _loadCustomers() {
            try {
                const model = this.controller.getView().getModel();
                const binding = model.bindList("/Customers");
                const contexts = await binding.requestContexts(0, 400);
                const customers = contexts.map((ctx) => ctx.getObject());
                this._getOrderWizardModel().setProperty("/customers", customers);
                this._applyCustomerFilter();
                this._updateCustomerSelection();
            } catch (e) {
                this._getOrderWizardModel().setProperty("/customers", []);
            }
        }

        async _loadCountries() {
            try {
                const model = this.controller.getView().getModel();
                const binding = model.bindList("/Countries");
                const contexts = await binding.requestContexts(0, 400);
                const countries = contexts.map((ctx) => ctx.getObject());
                this._getOrderWizardModel().setProperty("/countries", countries);
            } catch (e) {
                this._getOrderWizardModel().setProperty("/countries", []);
            }
        }

        _applyCustomerFilter() {
            const list = this.controller.byId("wizardCustomerList");
            if (!list) {
                return;
            }
            const binding = list.getBinding("items");
            if (!binding) {
                return;
            }
            const search = (this._getOrderWizardModel().getProperty("/customerSearch") || "").toLowerCase();
            if (!search) {
                binding.filter([]);
                return;
            }
            const filters = [
                new Filter({
                    path: "firstName",
                    operator: FilterOperator.Contains,
                    value1: search,
                    caseSensitive: false
                }),
                new Filter({
                    path: "lastName",
                    operator: FilterOperator.Contains,
                    value1: search,
                    caseSensitive: false
                }),
                new Filter({
                    path: "email",
                    operator: FilterOperator.Contains,
                    value1: search,
                    caseSensitive: false
                })
            ];
            binding.filter([new Filter({ filters, and: false })]);
        }

        _updateCustomerSelection() {
            const list = this.controller.byId("wizardCustomerList");
            if (!list) {
                return;
            }
            const customerId = this._getOrderWizardModel().getProperty("/customerId");
            if (!customerId) {
                list.removeSelections(true);
                return;
            }
            const items = list.getItems();
            const match = items.find((item) => {
                const context = item.getBindingContext("wizard");
                return context && context.getProperty("ID") === customerId;
            });
            list.removeSelections(true);
            if (match) {
                list.setSelectedItem(match);
            } else {
                list.attachEventOnce("updateFinished", () => {
                    this._updateCustomerSelection();
                });
            }
        }

        _getWizard() {
            return this.controller.byId("orderWizard");
        }

        _syncSelectedItems() {
            const model = this._getOrderWizardModel();
            const items = model.getProperty("/items") || [];
            const selectedItems = items.filter((item) => item.selectedQuantity > 0 && item.selectedQuantity <= (item.stock || 0));
            model.setProperty("/selectedItems", selectedItems);
            this._updateSummary();
            this._validateWizardState();
        }

        _updateSummary() {
            const model = this._getOrderWizardModel();
            const selectedItems = model.getProperty("/selectedItems") || [];
            const itemCount = selectedItems.reduce((count, item) => count + item.selectedQuantity, 0);
            const total = selectedItems.reduce((sum, item) => sum + (item.selectedQuantity * (item.price || 0)), 0);
            model.setProperty("/summary/itemCount", itemCount);
            model.setProperty("/summary/total", total);
            model.setProperty("/summary/customerLabel", this._buildCustomerLabel());
        }

        _buildCustomerLabel() {
            const model = this._getOrderWizardModel();
            const mode = model.getProperty("/customerMode");
            if (mode === "existing") {
                const id = model.getProperty("/customerId");
                const customers = model.getProperty("/customers") || [];
                const found = customers.find((c) => c.ID === id);
                if (found) {
                    return formatter.formatCustomerName(found.firstName, found.lastName);
                }
                return "Not selected";
            }
            const newCustomer = model.getProperty("/newCustomer") || {};
            const name = formatter.formatCustomerName(newCustomer.firstName, newCustomer.lastName);
            return name || "Not selected";
        }

        _validateWizardState() {
            const model = this._getOrderWizardModel();
            const data = model.getData();
            const customerValid = data.customerMode === "existing"
                ? !!data.customerId
                : !!data.newCustomer.firstName && !!data.newCustomer.lastName;
            const typeValid = this.typeOptions.includes(data.orderType);
            const itemsValid = data.selectedItems.length > 0 && data.selectedItems.every((item) => item.selectedQuantity > 0 && item.selectedQuantity <= (item.stock || 0));
            model.setProperty("/validations/customer", customerValid);
            model.setProperty("/validations/type", typeValid);
            model.setProperty("/validations/items", itemsValid);
            this._updateWizardSteps(customerValid, typeValid, itemsValid);
        }

        _updateWizardSteps(customerValid, typeValid, itemsValid) {
            const wizard = this._getWizard();
            if (!wizard) {
                return;
            }
            const customerStep = this.controller.byId("wizardCustomerStep");
            const typeStep = this.controller.byId("wizardTypeStep");
            const itemsStep = this.controller.byId("wizardItemsStep");
            if (customerStep) {
                if (customerValid) {
                    wizard.validateStep(customerStep);
                } else {
                    wizard.invalidateStep(customerStep);
                }
            }
            if (typeStep) {
                if (typeValid) {
                    wizard.validateStep(typeStep);
                } else {
                    wizard.invalidateStep(typeStep);
                }
            }
            if (itemsStep) {
                if (itemsValid) {
                    wizard.validateStep(itemsStep);
                } else {
                    wizard.invalidateStep(itemsStep);
                }
            }
        }

        async _loadItemsForType(type, presetSelections = []) {
            if (!type) {
                this._getOrderWizardModel().setProperty("/items", []);
                this._getOrderWizardModel().setProperty("/selectedItems", []);
                this._updateSummary();
                this._validateWizardState();
                return;
            }
            try {
                const model = this.controller.getView().getModel();
                const binding = model.bindList("/Items", null, null, [new Filter("type", FilterOperator.EQ, type)]);
                this._wizardItemsBinding = binding;
                const contexts = await binding.requestContexts(0, 400);
                const selections = Array.isArray(presetSelections) ? presetSelections : [];
                this._itemContextMap = {};
                const items = contexts.map((ctx) => {
                    const data = ctx.getObject();
                    this._itemContextMap[data.ID] = ctx;
                    const matched = selections.find((s) => s.id === data.ID);
                    const quantity = matched && matched.quantity ? Math.min(matched.quantity, data.stock || 0) : 0;
                    return Object.assign({}, data, { selectedQuantity: quantity });
                });
                this._getOrderWizardModel().setProperty("/items", items);
                this._syncSelectedItems();
            } catch (e) {
                this._getOrderWizardModel().setProperty("/items", []);
                this._syncSelectedItems();
            }
        }

        _getTodayDateString() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        }

        async _submitOrder() {
            const dialog = await this._loadOrderWizard();
            dialog.setBusy(true);
            try {
                const model = this.controller.getView().getModel();
                const data = this._getOrderWizardModel().getData();
                const insufficient = (data.selectedItems || []).some((item) => {
                    const context = this._itemContextMap[item.ID];
                    const currentStock = context ? context.getProperty("stock") : item.stock;
                    return item.selectedQuantity > (currentStock || 0);
                });
                if (insufficient) {
                    MessageBox.error("One or more items are no longer available in the selected quantity.");
                    dialog.setBusy(false);
                    await this._loadItemsForType(data.orderType);
                    return;
                }
                let customerId = data.customerId;
                if (data.customerMode === "new") {
                    customerId = await this._createCustomer(data.newCustomer);
                }
                const orderId = await this._createOrder({
                    customerId,
                    orderType: data.orderType,
                    orderDate: data.orderDate
                });
                await this._createOrderItems(orderId, data.selectedItems);
                await this._updateStock(data.selectedItems);
                if (model && model.refresh) {
                    model.refresh();
                }
                dialog.close();
                MessageToast.show("Order created.");
            } catch (e) {
                MessageBox.error("Could not create the order right now.");
            } finally {
                dialog.setBusy(false);
            }
        }

        async _createCustomer(payload) {
            const model = this.controller.getView().getModel();
            const binding = model.bindList("/Customers");
            const customerContext = binding.create({
                firstName: payload.firstName,
                lastName: payload.lastName,
                email: payload.email || null,
                phone: payload.phone || null,
                country_ID: payload.country_ID || null,
                address: payload.address || null,
                postalCode: payload.postalCode || null
            });
            await customerContext.created();
            return customerContext.getProperty("ID");
        }

        async _createOrder({ customerId, orderType, orderDate }) {
            const model = this.controller.getView().getModel();
            const binding = model.bindList("/Orders");
            const orderContext = binding.create({
                date: orderDate || this._getTodayDateString(),
                type: orderType,
                status: "Submitted",
                customer_ID: customerId
            });
            await orderContext.created();
            return orderContext.getProperty("ID");
        }

        async _createOrderItems(orderId, items) {
            const model = this.controller.getView().getModel();
            const binding = model.bindList("/OrderItems");
            const tasks = items.map((item) => {
                const context = binding.create({
                    order_ID: orderId,
                    item_ID: item.ID,
                    quantity: item.selectedQuantity,
                    unitPrice: item.price
                });
                return context.created();
            });
            await Promise.all(tasks);
        }

        async _updateStock(items) {
            const model = this.controller.getView().getModel();
            items.forEach((item) => {
                const context = this._itemContextMap[item.ID];
                const currentStock = context ? context.getProperty("stock") : item.stock;
                const nextStock = Math.max(0, (currentStock || 0) - item.selectedQuantity);
                if (context) {
                    context.setProperty("stock", nextStock);
                } else {
                    const itemContext = model.bindContext(`/Items('${item.ID}')`);
                    itemContext.setProperty("stock", nextStock);
                }
            });
            if (model && model.submitBatch) {
                await model.submitBatch("$auto");
            }
        }
    }

    return CreateOrder;
});
