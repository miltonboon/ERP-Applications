sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/Popover",
    "sap/m/VBox",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/SegmentedButton",
    "sap/m/SegmentedButtonItem",
    "sap/m/Button",
    "sap/m/MultiComboBox",
    "sap/m/Text",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/f/library",
    "sap/ui/model/json/JSONModel",
    "ordermanagement/ordermanagement/model/formatter"
], (Controller, Filter, FilterOperator, Sorter, Popover, VBox, Select, Item, SegmentedButton, SegmentedButtonItem, Button, MultiComboBox, Text, MessageBox, MessageToast, Fragment, fLibrary, JSONModel, formatter) => {
    "use strict";

    const LayoutType = fLibrary.LayoutType;
    const TYPE_OPTIONS = ["Ticket", "Merchandise", "FoodDrinks"];

    return Controller.extend("ordermanagement.ordermanagement.controller.OrderManagement", {
        formatter,

        onInit() {
            this._fcl = this.byId("fcl");
            this._statusLists = {
                Submitted: this.byId("listSubmitted"),
                Paid: this.byId("listPaid"),
                Cancelled: this.byId("listCancelled")
            };
            this._statusPanels = {
                Submitted: this.byId("panelSubmitted"),
                Paid: this.byId("panelPaid"),
                Cancelled: this.byId("panelCancelled")
            };
            this._sortPopover = null;
            this._sortSelect = null;
            this._sortDirection = null;
            this._filterPopover = null;
            this._filterType = null;
            this._searchQuery = "";
            this._filterTypes = [];
            this._sortState = { key: "", descending: false };
            this._orderWizardPromise = null;
            this._orderWizardModel = null;
            this._wizardItemsBinding = null;
            this._itemContextMap = {};
            this._applyFilters();
            this._applySort();
        },

        onSearch(event) {
            this._searchQuery = event.getParameter("query") || "";
            this._applyFilters();
        },

        onOpenSortPopover(event) {
            if (!this._sortPopover) {
                this._sortPopover = this._createSortPopover();
            }
            this._deferredOpen(this._sortPopover, event.getSource());
        },

        _createSortPopover() {
            this._sortSelect = new Select({
                width: "100%",
                change: this._applySort.bind(this)
            });
            this._sortSelect.addItem(new Item({ key: "date", text: "Order Date" }));
            this._sortSelect.setSelectedKey("date");

            this._sortDirection = new SegmentedButton({
                selectionChange: this._applySort.bind(this),
                items: [
                    new SegmentedButtonItem({ key: "asc", text: "Asc" }),
                    new SegmentedButtonItem({ key: "desc", text: "Desc" })
                ]
            });
            this._sortDirection.setSelectedKey("desc");
            this._sortDirection.setVisible(true);
            this._sortDirection.setEnabled(true);

            const content = new VBox({
                width: "16rem",
                items: [this._sortSelect, this._sortDirection]
            }).addStyleClass("sapUiSmallMargin");

            return new Popover({
                placement: "Bottom",
                showHeader: true,
                title: "Sort",
                content: [content]
            });
        },

        _applySort() {
            const key = this._sortSelect ? this._sortSelect.getSelectedKey() : "date";
            const descending = this._sortDirection ? this._sortDirection.getSelectedKey() === "desc" : true;
            const finalKey = key || "date";
            const sorters = [new Sorter(finalKey, descending)];
            this._sortState = { key: finalKey, descending };
            this._forEachStatusList((status, list) => {
                const binding = list && list.getBinding("items");
                if (binding) {
                    binding.sort(sorters);
                } else if (list) {
                    list.attachEventOnce("updateFinished", () => {
                        this._applySort();
                    });
                }
            });
        },

        onOpenFilterPopover(event) {
            if (!this._filterPopover) {
                this._filterPopover = this._createFilterPopover();
            }
            this._deferredOpen(this._filterPopover, event.getSource());
        },

        _createFilterPopover() {
            this._filterType = new MultiComboBox({
                width: "100%",
                selectionChange: this._onFilterSelectionChange.bind(this),
                placeholder: "Select order type"
            });
            TYPE_OPTIONS.forEach((t) => {
                this._filterType.addItem(new Item({ key: t, text: t }));
            });

            const clearButton = new Button({
                text: "Clear Filters",
                press: () => {
                    this._filterType.removeAllSelectedItems();
                    this._filterTypes = [];
                    this._applyFilters();
                }
            });

            const content = new VBox({
                width: "16rem",
                items: [
                    new Text({ text: "Order type" }),
                    this._filterType,
                    clearButton
                ]
            }).addStyleClass("sapUiSmallMargin");

            const pop = new Popover({
                placement: "Bottom",
                showHeader: true,
                title: "Filter",
                content: [content]
            });
            this.getView().addDependent(pop);
            return pop;
        },

        _onFilterSelectionChange() {
            this._filterTypes = this._filterType.getSelectedKeys();
            this._applyFilters();
        },

        _applyFilters() {
            const filters = [];

            if (this._searchQuery) {
                const searchFilters = [
                    new Filter({
                        path: "customerFirstName",
                        operator: FilterOperator.Contains,
                        value1: this._searchQuery,
                        caseSensitive: false
                    }),
                    new Filter({
                        path: "customerLastName",
                        operator: FilterOperator.Contains,
                        value1: this._searchQuery,
                        caseSensitive: false
                    })
                ];
                filters.push(new Filter({ filters: searchFilters, and: false }));
            }

            if (this._filterTypes.length > 0) {
                const typeFilters = this._filterTypes.map((t) => new Filter("type", FilterOperator.EQ, t));
                filters.push(new Filter({ filters: typeFilters, and: false }));
            }

            this._forEachStatusList((status, list, panel) => {
                const binding = list && list.getBinding("items");
                if (!binding) {
                    if (list) {
                        list.attachEventOnce("updateFinished", () => {
                            this._applyFilters();
                        });
                    }
                    return;
                }
                const statusFilter = new Filter("status", FilterOperator.EQ, status);
                const finalFilters = [statusFilter].concat(filters);
                binding.filter(finalFilters);
            });
        },

        onSelectOrder(event) {
            const listItem = event.getParameter("listItem");
            const context = listItem && listItem.getBindingContext();
            const detailView = this.byId("detailView");
            if (detailView && context) {
                const orderId = context.getProperty("ID");
                const overviewTotal = context.getProperty("totalAmount");
                const parsedOverviewTotal = typeof overviewTotal === "number" ? overviewTotal : parseFloat(overviewTotal);
                const overviewData = {
                    total: Number.isFinite(parsedOverviewTotal) ? parsedOverviewTotal : null,
                    firstName: context.getProperty("customerFirstName"),
                    lastName: context.getProperty("customerLastName"),
                    type: context.getProperty("type"),
                    status: context.getProperty("status"),
                    date: context.getProperty("date"),
                    id: orderId
                };
                const overviewModel = detailView.getModel("overview") || new JSONModel();
                overviewModel.setData(overviewData);
                detailView.setModel(overviewModel, "overview");
                if (orderId) {
                    detailView.bindElement({
                        path: this._buildOrderPath(orderId),
                        parameters: {
                            $expand: "customer($select=ID,firstName,lastName,email,phone,address,postalCode,country_ID;$expand=country($select=ID,name,code)),items($expand=item)"
                        }
                    });
                    const elementBinding = detailView.getElementBinding();
                    const boundContext = elementBinding && elementBinding.getBoundContext ? elementBinding.getBoundContext() : null;
                    if (boundContext && boundContext.requestObject) {
                        boundContext.requestObject().then((data) => {
                            const items = Array.isArray(data.items) ? data.items : [];
                            const computedTotal = items.reduce((sum, item) => {
                                const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity);
                                const price = typeof item.unitPrice === "number" ? item.unitPrice : parseFloat(item.unitPrice);
                                if (Number.isNaN(qty) || Number.isNaN(price)) {
                                    return sum;
                                }
                                return sum + (qty * price);
                            }, 0);
                            const merged = Object.assign({}, overviewData, {
                                firstName: (data.customer && data.customer.firstName) || overviewData.firstName,
                                lastName: (data.customer && data.customer.lastName) || overviewData.lastName,
                                type: data.type || overviewData.type,
                                status: data.status || overviewData.status,
                                date: data.date || overviewData.date,
                                total: Number.isFinite(computedTotal) ? computedTotal : overviewData.total
                            });
                            overviewModel.setData(merged);
                        }).catch(() => {
                            overviewModel.setData(overviewData);
                        });
                    }
                } else {
                    detailView.unbindElement();
                    overviewModel.setData({});
                }
            }
            const sourceList = event.getSource();
            this._clearOtherSelections(sourceList);
            if (this._fcl) {
                this._fcl.setLayout(LayoutType.TwoColumnsBeginExpanded);
            }
        },

        async onOpenCreateOrder() {
            this._resetWizardModel();
            const dialog = await this._loadOrderWizard();
            dialog.setBusy(false);
            dialog.open();
            const wizard = this._getWizard();
            if (wizard) {
                const steps = wizard.getSteps();
                if (steps && steps.length > 0) {
                    wizard.discardProgress(steps[0]);
                    wizard.goToStep(this.byId("wizardCustomerStep"));
                }
            }
            await Promise.all([this._loadCustomers(), this._loadCountries()]);
            this._updateSummary();
            this._validateWizardState();
        },

        onCloseOrderWizard() {
            this._loadOrderWizard().then((dialog) => {
                dialog.close();
            });
        },

        onCustomerModeChange(event) {
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
        },

        onNewCustomerChange() {
            this._updateSummary();
            this._validateWizardState();
        },

        onCustomerSearch(event) {
            const search = event.getParameter("newValue") || "";
            this._getOrderWizardModel().setProperty("/customerSearch", search);
            this._applyCustomerFilter();
        },

        onSelectCustomer(event) {
            const listItem = event.getParameter("listItem");
            const context = listItem && listItem.getBindingContext("wizard");
            const id = context ? context.getProperty("ID") : "";
            this._getOrderWizardModel().setProperty("/customerId", id);
            this._updateCustomerSelection();
            this._updateSummary();
            this._validateWizardState();
        },

        onOrderTypeChange(event) {
            const type = event.getSource().getSelectedKey();
            this._getOrderWizardModel().setProperty("/orderType", type);
            this._loadItemsForType(type).then(() => {
                this._updateSummary();
                this._validateWizardState();
            });
        },

        onOrderDateChange(event) {
            const dateValue = event.getParameter("value");
            const model = this._getOrderWizardModel();
            const finalValue = dateValue || this._getTodayDateString();
            model.setProperty("/orderDate", finalValue);
            this._updateSummary();
            this._validateWizardState();
        },

        onItemQuantityChange(event) {
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
        },

        onContinueFromCustomer() {
            const validations = this._getOrderWizardModel().getProperty("/validations");
            if (!validations.customer) {
                MessageBox.error("Select or add a customer to continue.");
                return;
            }
            const wizard = this._getWizard();
            if (wizard) {
                wizard.nextStep();
            }
        },

        onContinueFromType() {
            const validations = this._getOrderWizardModel().getProperty("/validations");
            if (!validations.type) {
                MessageBox.error("Choose an order type to continue.");
                return;
            }
            const wizard = this._getWizard();
            if (wizard) {
                wizard.nextStep();
            }
        },

        onContinueFromItems() {
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
        },

        onBackToCustomer() {
            const wizard = this._getWizard();
            if (wizard) {
                wizard.goToStep(this.byId("wizardCustomerStep"));
            }
        },

        onBackToType() {
            const wizard = this._getWizard();
            if (wizard) {
                wizard.goToStep(this.byId("wizardTypeStep"));
            }
        },

        async onConfirmOrder() {
            const validations = this._getOrderWizardModel().getProperty("/validations");
            if (!validations.customer || !validations.type || !validations.items) {
                MessageBox.error("Complete all steps before confirming the order.");
                return;
            }
            await this._submitOrder();
        },

        _getOrderWizardModel() {
            if (!this._orderWizardModel) {
                this._orderWizardModel = new JSONModel(this._getWizardDefaults());
            }
            return this._orderWizardModel;
        },

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
        },

        _resetWizardModel() {
            this._getOrderWizardModel().setData(this._getWizardDefaults());
        },

        _loadOrderWizard() {
            if (!this._orderWizardPromise) {
                this._orderWizardPromise = Fragment.load({
                    id: this.getView().getId(),
                    name: "ordermanagement.ordermanagement.fragment.OrderWizard",
                    controller: this
                }).then((dialog) => {
                    this.getView().addDependent(dialog);
                    dialog.setModel(this._getOrderWizardModel(), "wizard");
                    return dialog;
                });
            }
            return this._orderWizardPromise;
        },

        async _loadCustomers() {
            try {
                const model = this.getView().getModel();
                const binding = model.bindList("/Customers");
                const contexts = await binding.requestContexts(0, 400);
                const customers = contexts.map((ctx) => ctx.getObject());
                this._getOrderWizardModel().setProperty("/customers", customers);
                this._applyCustomerFilter();
                this._updateCustomerSelection();
            } catch (e) {
                this._getOrderWizardModel().setProperty("/customers", []);
            }
        },

        async _loadCountries() {
            try {
                const model = this.getView().getModel();
                const binding = model.bindList("/Countries");
                const contexts = await binding.requestContexts(0, 400);
                const countries = contexts.map((ctx) => ctx.getObject());
                this._getOrderWizardModel().setProperty("/countries", countries);
            } catch (e) {
                this._getOrderWizardModel().setProperty("/countries", []);
            }
        },

        _applyCustomerFilter() {
            const list = this.byId("wizardCustomerList");
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
        },

        _updateCustomerSelection() {
            const list = this.byId("wizardCustomerList");
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
        },

        _getWizard() {
            return this.byId("orderWizard");
        },

        _syncSelectedItems() {
            const model = this._getOrderWizardModel();
            const items = model.getProperty("/items") || [];
            const selectedItems = items.filter((item) => item.selectedQuantity > 0 && item.selectedQuantity <= (item.stock || 0));
            model.setProperty("/selectedItems", selectedItems);
            this._updateSummary();
            this._validateWizardState();
        },

        _updateSummary() {
            const model = this._getOrderWizardModel();
            const selectedItems = model.getProperty("/selectedItems") || [];
            const itemCount = selectedItems.reduce((count, item) => count + item.selectedQuantity, 0);
            const total = selectedItems.reduce((sum, item) => sum + (item.selectedQuantity * (item.price || 0)), 0);
            model.setProperty("/summary/itemCount", itemCount);
            model.setProperty("/summary/total", total);
            model.setProperty("/summary/customerLabel", this._buildCustomerLabel());
        },

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
        },

        _validateWizardState() {
            const model = this._getOrderWizardModel();
            const data = model.getData();
            const customerValid = data.customerMode === "existing"
                ? !!data.customerId
                : !!data.newCustomer.firstName && !!data.newCustomer.lastName;
            const typeValid = TYPE_OPTIONS.includes(data.orderType);
            const itemsValid = data.selectedItems.length > 0 && data.selectedItems.every((item) => item.selectedQuantity > 0 && item.selectedQuantity <= (item.stock || 0));
            model.setProperty("/validations/customer", customerValid);
            model.setProperty("/validations/type", typeValid);
            model.setProperty("/validations/items", itemsValid);
            this._updateWizardSteps(customerValid, typeValid, itemsValid);
        },

        _updateWizardSteps(customerValid, typeValid, itemsValid) {
            const wizard = this._getWizard();
            if (!wizard) {
                return;
            }
            const customerStep = this.byId("wizardCustomerStep");
            const typeStep = this.byId("wizardTypeStep");
            const itemsStep = this.byId("wizardItemsStep");
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
        },

        async _loadItemsForType(type, presetSelections = []) {
            if (!type) {
                this._getOrderWizardModel().setProperty("/items", []);
                this._getOrderWizardModel().setProperty("/selectedItems", []);
                this._updateSummary();
                this._validateWizardState();
                return;
            }
            try {
                const model = this.getView().getModel();
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
        },

        _getTodayDateString() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        },

        async _submitOrder() {
            const dialog = await this._loadOrderWizard();
            dialog.setBusy(true);
            try {
                const model = this.getView().getModel();
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
        },

        async _createCustomer(payload) {
            const model = this.getView().getModel();
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
        },

        async _createOrder({ customerId, orderType, orderDate }) {
            const model = this.getView().getModel();
            const binding = model.bindList("/Orders");
            const orderContext = binding.create({
                date: orderDate || this._getTodayDateString(),
                type: orderType,
                status: "Submitted",
                customer_ID: customerId
            });
            await orderContext.created();
            return orderContext.getProperty("ID");
        },

        async _createOrderItems(orderId, items) {
            const model = this.getView().getModel();
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
        },

        async _updateStock(items) {
            const model = this.getView().getModel();
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
        },

        formatCustomerName(firstName, lastName) {
            return formatter.formatCustomerName(firstName, lastName);
        },

        formatStatusState(status) {
            return formatter.formatStatusState(status);
        },

        formatAmount(value) {
            return formatter.formatAmount(value);
        },

        calculateItemTotal(quantity, unitPrice) {
            return formatter.calculateItemTotal(quantity, unitPrice);
        },

        formatOrderType(type) {
            return formatter.formatOrderType(type);
        },

        formatDate(value) {
            return formatter.formatDate(value);
        },

        _forEachStatusList(callback) {
            Object.keys(this._statusLists || {}).forEach((status) => {
                callback(status, this._statusLists[status], this._statusPanels[status]);
            });
        },

        _clearOtherSelections(sourceList) {
            this._forEachStatusList((_status, list) => {
                if (list && list !== sourceList) {
                    list.removeSelections(true);
                }
            });
        },

        _buildOrderPath(orderId) {
            return `/Orders('${orderId}')`;
        },

        _deferredOpen(popover, opener) {
            if (!popover || !opener) {
                return;
            }
            setTimeout(() => {
                if (popover.isOpen && popover.isOpen()) {
                    popover.close();
                }
                popover.openBy(opener);
            }, 0);
        }
    });
});
