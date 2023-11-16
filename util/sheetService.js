'use strict';

const { v5: uuidv5 } = require('uuid');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const _ = require('lodash');

const AVAILABLE_LOCALES = [
    "en",
    "en-US",
    "en-GB",
    "en-CA",
    "en-AU",
    "en-IN",
    "de-DE",
    "ja-JP",
    "es-ES",
    "es-MX",
    "es-US",
    "fr-FR",
    "fr-CA",
    "it-IT",
    "pt-BR"
];

class SheetService {
    constructor(sheetId, credentials) {
        this.credentials = credentials;
        this.doc = new GoogleSpreadsheet(sheetId);
        this.invocationNames = [];
        this.intentsWorksheets = [];
        this.utterancesWorksheets = [];
        this.slotWorksheets = [];
        this.downloadWorksheets = [];
        this.otherWorksheets = [];
        // this.dialogflowActionIds = [];
        this.viewsWorksheets = [];
        this.audiosWorksheets = [];
        this.locale = 'en';
    }

    async loadDoc() {
        await this.doc.useServiceAccountAuth(this.credentials);
        await this.doc.loadInfo();

        this.locale = this.getLocale();

        for (const sheet of this.doc.sheetsByIndex) {
            const title = _.toUpper(sheet.title);

            if (_.startsWith(title, 'INTENT')) {
                this.intentsWorksheets.push(sheet);
            } else if (_.startsWith(title, 'UTTERANCES')) {
                this.utterancesWorksheets.push(sheet);
            } else if (_.startsWith(title, 'SLOT_') || _.startsWith(title, 'ENTITY_')) {
                this.slotWorksheets.push(sheet);
            } else if (_.startsWith(title, 'INVOCATION_NAMES')) {
                this.invocationNames.push(sheet);
            } else if (_.startsWith(title, 'DOWNLOAD_')) {
                this.downloadWorksheets.push(sheet);
            } else if (_.startsWith(title, 'VIEWS_FILE')) {
                this.viewsWorksheets.push(sheet);
            } else if (_.startsWith(title, 'AUDIOS_FILE')) {
                this.audiosWorksheets.push(sheet);
            } else {
                this.otherWorksheets.push(sheet);
            }
        }
    }

    getLocale() {
        const title = this.doc.title;
        let locale = AVAILABLE_LOCALES.find((loc) => {
            return _.endsWith(title, _.toLower(loc));
        });
        locale = locale || AVAILABLE_LOCALES[0];

        return locale;
    }
}

module.exports = SheetService;