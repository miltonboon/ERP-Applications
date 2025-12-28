sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "artistmanagement/model/formatter",
    "./Avatar"
], (JSONModel, Fragment, MessageToast, MessageBox, formatter, AvatarUtil) => {
    "use strict";

    const GENRE_KEYS = ["POP", "ROCK", "HIPHOP", "EDM", "TECHNO", "HOUSE", "JAZZ", "CLASSICAL", "RNB", "INDIE", "METAL", "LATIN", "AFROBEATS", "FOLK", "BLUES", "FUNK", "COUNTRY"];

    const getGenreOptions = () => GENRE_KEYS.map((key) => ({
        key,
        text: formatter.formatGenre(key)
    }));

    const getEmptyPerformance = () => ({
        stageId: "",
        day: "",
        startTime: "",
        endTime: "",
        errors: {
            stageId: "",
            day: "",
            startTime: "",
            endTime: "",
            timeRange: ""
        }
    });

    const getDefaultCreateData = () => ({
        form: {
            name: "",
            genres: [],
            countryId: "",
            biography: "",
            spotifyUrl: "",
            instagramHandle: "",
            avatar: "",
            avatarMimeType: "",
            performances: [getEmptyPerformance()]
        },
        options: {
            genres: getGenreOptions(),
            countries: [],
            stages: []
        },
        errors: {
            name: "",
            genres: "",
            countryId: ""
        }
    });

    const getCreateModel = (controller) => {
        if (!controller._createModel) {
            controller._createModel = new JSONModel(getDefaultCreateData());
        }
        return controller._createModel;
    };

    const getCreateArtistDialog = (controller) => {
        if (!controller._createDialogPromise) {
            controller._createDialogPromise = Fragment.load({
                id: controller.getView().getId(),
                name: "artistmanagement.fragments.CreateArtistWizard",
                controller
            }).then((dialog) => {
                dialog.setModel(getCreateModel(controller), "createModel");
                controller.getView().addDependent(dialog);
                return dialog;
            });
        }
        return controller._createDialogPromise;
    };

    const setStepValidated = (step, isValid) => {
        if (step && step.setValidated) {
            step.setValidated(!!isValid);
        }
    };

    const getWizardSteps = (controller) => ([
        controller.byId("basicInfoStep"),
        controller.byId("biographyStep"),
        controller.byId("socialStep"),
        controller.byId("performancesStep"),
        controller.byId("avatarStep")
    ]).filter(Boolean);

    const syncWizardButtons = (controller) => {
        const wizard = controller.byId("createArtistWizard");
        const create = controller.byId("wizardCreateButton");
        if (!wizard || !create) {
            return;
        }
        create.setVisible(true);
    };

    const validateBasicInfo = (controller) => {
        const model = getCreateModel(controller);
        const form = model.getProperty("/form") || {};
        const errors = {
            name: form.name ? "" : "Enter the artist name",
            genres: Array.isArray(form.genres) && form.genres.length > 0 ? "" : "Select at least one genre",
            countryId: form.countryId ? "" : "Select a country"
        };
        model.setProperty("/errors", errors);
        setStepValidated(controller.byId("basicInfoStep"), !errors.name && !errors.genres && !errors.countryId);
        return !errors.name && !errors.genres && !errors.countryId;
    };

    const combineDateAndTime = (day, time) => {
        const [year, month, date] = (day || "").split("-").map(Number);
        const [hours, minutes] = (time || "").split(":").map(Number);
        return new Date(Date.UTC(year || 0, (month || 1) - 1, date || 1, hours || 0, minutes || 0));
    };

    const validatePerformances = (controller) => {
        const model = getCreateModel(controller);
        const performances = model.getProperty("/form/performances") || [];
        let valid = performances.length > 0;
        performances.forEach((perf, index) => {
            const errors = {
                stageId: perf.stageId ? "" : "Choose a stage",
                day: perf.day ? "" : "Select a day",
                startTime: perf.startTime ? "" : "Select a start time",
                endTime: perf.endTime ? "" : "Select an end time",
                timeRange: ""
            };
            if (perf.day && perf.startTime && perf.endTime) {
                const start = combineDateAndTime(perf.day, perf.startTime);
                const end = combineDateAndTime(perf.day, perf.endTime);
                if (start >= end) {
                    errors.timeRange = "End time must be after start time";
                }
            }
            if (errors.stageId || errors.day || errors.startTime || errors.endTime || errors.timeRange) {
                valid = false;
            }
            model.setProperty(`/form/performances/${index}/errors`, errors);
        });
        if (performances.length === 0) {
            MessageToast.show("Add at least one performance slot.");
        }
        setStepValidated(controller.byId("performancesStep"), valid);
        return valid;
    };

    const resetWizardState = (controller) => {
        const model = getCreateModel(controller);
        model.setData(getDefaultCreateData());
        const wizard = controller.byId("createArtistWizard");
        const firstStep = controller.byId("basicInfoStep");
        controller._currentWizardStepIndex = 0;
        if (wizard && firstStep) {
            wizard.discardProgress(firstStep);
            wizard.goToStep(firstStep);
            setStepValidated(firstStep, false);
            const biographyStep = controller.byId("biographyStep");
            const socialStep = controller.byId("socialStep");
            const performancesStep = controller.byId("performancesStep");
            const avatarStep = controller.byId("avatarStep");
            setStepValidated(biographyStep, true);
            setStepValidated(socialStep, true);
            setStepValidated(performancesStep, false);
            setStepValidated(avatarStep, true);
        }
        syncWizardButtons(controller);
    };

    const loadCountryOptions = (controller) => {
        const oDataModel = controller.getView().getModel();
        if (!oDataModel) {
            return;
        }
        const binding = oDataModel.bindList("/Countries", undefined, undefined, undefined, {
            $select: "ID,name"
        });
        binding.requestContexts(0, 200).then((contexts) => {
            const countries = contexts.map((ctx) => ({
                key: ctx.getProperty("ID") || "",
                text: ctx.getProperty("name") || ""
            }));
            getCreateModel(controller).setProperty("/options/countries", countries);
        }).catch(() => {
            getCreateModel(controller).setProperty("/options/countries", []);
        });
    };

    const loadStageOptions = (controller) => {
        const oDataModel = controller.getView().getModel();
        if (!oDataModel) {
            return;
        }
        const binding = oDataModel.bindList("/Stages", undefined, undefined, undefined, {
            $select: "ID,name"
        });
        binding.requestContexts(0, 200).then((contexts) => {
            const stages = contexts.map((ctx) => ({
                key: ctx.getProperty("ID") || "",
                text: ctx.getProperty("name") || ""
            }));
            getCreateModel(controller).setProperty("/options/stages", stages);
        }).catch(() => {
            getCreateModel(controller).setProperty("/options/stages", []);
        });
    };

    const loadCreateOptions = (controller) => {
        loadCountryOptions(controller);
        loadStageOptions(controller);
    };

    const buildCreatePayload = (controller) => {
        const form = getCreateModel(controller).getProperty("/form") || {};
        const performances = (form.performances || []).map((perf) => {
            const startDate = combineDateAndTime(perf.day, perf.startTime);
            const endDate = combineDateAndTime(perf.day, perf.endTime);
            return {
                startAt: startDate.toISOString(),
                endAt: endDate.toISOString(),
                stage_ID: perf.stageId
            };
        });
        return {
            name: form.name,
            genres: form.genres || [],
            biography: form.biography || "",
            spotifyUrl: form.spotifyUrl || "",
            instagramHandle: form.instagramHandle || "",
            avatar: form.avatar || null,
            avatarMimeType: form.avatarMimeType || "",
            country_ID: form.countryId,
            performances
        };
    };

    const openCreateArtist = (controller) => {
        resetWizardState(controller);
        loadCreateOptions(controller);
        return getCreateArtistDialog(controller).then((dialog) => {
            dialog.open();
            syncWizardButtons(controller);
            validateBasicInfo(controller);
        });
    };

    const cancelCreateArtist = (controller) => getCreateArtistDialog(controller).then((dialog) => dialog.close());

    const handleWizardStepChange = (controller, event) => {
        const wizard = event.getSource();
        const step = event.getParameter("step");
        const steps = getWizardSteps(controller);
        const newIndex = steps.indexOf(step);
        if (newIndex === -1) {
            return;
        }
        const prevIndex = controller._currentWizardStepIndex || 0;
        const basicStep = controller.byId("basicInfoStep");
        const performancesStep = controller.byId("performancesStep");
        const basicIndex = steps.indexOf(basicStep);
        const performanceIndex = steps.indexOf(performancesStep);

        if (newIndex > prevIndex && basicIndex > -1 && newIndex > basicIndex && !validateBasicInfo(controller)) {
            MessageToast.show("Fill in the basic artist info.");
            wizard.goToStep(basicStep);
            return;
        }
        if (newIndex > prevIndex && performanceIndex > -1 && newIndex > performanceIndex && !validatePerformances(controller)) {
            MessageToast.show("Fix the performance details before continuing.");
            wizard.goToStep(performancesStep);
            return;
        }
        controller._currentWizardStepIndex = newIndex;
        syncWizardButtons(controller);
    };

    const wizardNavNext = (controller) => {
        const wizard = controller.byId("createArtistWizard");
        if (!wizard) {
            return;
        }
        const currentStepId = wizard.getCurrentStep();
        const basicStepId = controller.byId("basicInfoStep") && controller.byId("basicInfoStep").getId();
        const performanceStepId = controller.byId("performancesStep") && controller.byId("performancesStep").getId();

        if (currentStepId === basicStepId && !validateBasicInfo(controller)) {
            MessageToast.show("Fill in the required basic info first.");
            return;
        }
        if (currentStepId === performanceStepId && !validatePerformances(controller)) {
            MessageToast.show("Fix the performance details before continuing.");
            return;
        }
        wizard.nextStep();
        syncWizardButtons(controller);
    };

    const wizardNavBack = (controller) => {
        const wizard = controller.byId("createArtistWizard");
        if (!wizard) {
            return;
        }
        wizard.previousStep();
        syncWizardButtons(controller);
    };

    const addPerformanceRow = (controller) => {
        const model = getCreateModel(controller);
        const performances = model.getProperty("/form/performances") || [];
        performances.push(getEmptyPerformance());
        model.setProperty("/form/performances", performances);
        validatePerformances(controller);
    };

    const removePerformanceRow = (controller, event) => {
        const context = event.getSource().getBindingContext("createModel");
        if (!context) {
            return;
        }
        const performances = getCreateModel(controller).getProperty("/form/performances") || [];
        if (performances.length <= 1) {
            MessageToast.show("Keep at least one performance slot.");
            return;
        }
        const path = context.getPath();
        const index = Number(path.split("/").pop());
        if (Number.isInteger(index) && index >= 0) {
            performances.splice(index, 1);
            getCreateModel(controller).setProperty("/form/performances", performances);
            validatePerformances(controller);
        }
    };

    const createArtist = (controller) => {
        const wizard = controller.byId("createArtistWizard");
        const validBasic = validateBasicInfo(controller);
        const validPerformances = validatePerformances(controller);
        if (!validBasic) {
            if (wizard) {
                wizard.goToStep(controller.byId("basicInfoStep"));
                syncWizardButtons(controller);
            }
            MessageToast.show("Fill in the basic artist info.");
            return;
        }
        if (!validPerformances) {
            if (wizard) {
                wizard.goToStep(controller.byId("performancesStep"));
                syncWizardButtons(controller);
            }
            return;
        }

        const payload = buildCreatePayload(controller);
        const dialogPromise = getCreateArtistDialog(controller);
        dialogPromise.then((dialog) => dialog.setBusy(true));

        const oDataModel = controller.getView().getModel();
        const listBinding = oDataModel.bindList("/Artists");
        const context = listBinding.create(payload);
        context.created().then(() => context.requestObject()).then(() => {
            dialogPromise.then((dialog) => dialog.setBusy(false));
            dialogPromise.then((dialog) => dialog.close());
            resetWizardState(controller);
            if (controller._list && controller._list.getBinding("items")) {
                controller._list.getBinding("items").refresh();
            }
            MessageToast.show("Artist created");
        }).catch((err) => {
            dialogPromise.then((dialog) => dialog.setBusy(false));
            MessageBox.error("Create failed. Please try again.");
            // eslint-disable-next-line no-console
            console.error("Create artist failed", err);
        });
    };

    const basicFieldChange = (controller) => {
        validateBasicInfo(controller);
        syncWizardButtons(controller);
    };

    const performanceFieldChange = (controller) => {
        validatePerformances(controller);
        syncWizardButtons(controller);
    };

    const handleAvatarSelected = (controller, event) => {
        const files = event.getParameter("files");
        const file = files && files[0];
        if (!file) {
            return;
        }
        if (!file.type || !file.type.startsWith("image/")) {
            MessageToast.show("Select an image file.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e && e.target && e.target.result;
            if (typeof result !== "string") {
                return;
            }
            AvatarUtil.downscaleAvatar(result).then(({ dataUrl, mimeType }) => {
                const base64 = dataUrl.split(",")[1] || "";
                const model = getCreateModel(controller);
                model.setProperty("/form/avatar", base64);
                model.setProperty("/form/avatarMimeType", mimeType || "image/jpeg");
            }).catch(() => {
                MessageToast.show("Avatar upload failed.");
            });
        };
        reader.readAsDataURL(file);
    };

    const clearAvatar = (controller) => {
        const model = getCreateModel(controller);
        model.setProperty("/form/avatar", "");
        model.setProperty("/form/avatarMimeType", "");
    };

    return {
        openCreateArtist,
        cancelCreateArtist,
        handleWizardStepChange,
        wizardNavNext,
        wizardNavBack,
        addPerformanceRow,
        removePerformanceRow,
        createArtist,
        basicFieldChange,
        performanceFieldChange,
        handleAvatarSelected,
        clearAvatar,
        getGenreOptions,
        combineDateAndTime
    };
});
