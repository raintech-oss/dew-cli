exports.command = 'sheet'
exports.desc = 'Import from a Google Sheet'
exports.builder = {
    sheetId: {
        alias: 's',
        desc: 'sheetId(s) to import',
        type: 'array',
        demandOption: true
    },
    contentPath: {
        desc: 'output path for content',
        type: 'string',
        default: './src/content'
    },
    modelPath: {
        desc: 'output path for model(s)',
        type: 'string',
        default: './models'
    },
    credentials: {
        desc: 'credentials file',
        type: 'string',
        default: './client_secret.json',
        demandOption: true,
    },
    i18nPath: {
        desc: 'output path for i18n file(s)',
        type: 'string',
        default: './src/i18n'
    },
    platform: {
        desc: 'platform(s) to include',
        type: 'array'
    },
    formatVersion: {
        desc: 'controls output format based on version',
        type: 'number',
        default: 4
    }
}

const fs = require('fs');
const path = require('path');
const chalk = require("chalk");
const _ = require("lodash");
const SheetService = require('../util/sheetService');
const converters = require('../util/converters');

exports.handler = async function (argv) {
    for (const sheetId of argv.sheetId) {
        const sheetService = new SheetService(sheetId, argv.credentials);
        await sheetService.loadDoc();

        console.log(`Google Sheet loaded: ${chalk.yellow.bold(sheetService.doc.title)} (${sheetId})`);
        console.log(`locale: ${chalk.yellow(sheetService.locale)}`);

        if (sheetService.intentsWorksheets.length > 0) {
            console.log(`processing ${chalk.yellow(sheetService.intentsWorksheets.length)} INTENT worksheet(s)...`);
            for (const sheet of sheetService.intentsWorksheets) {
                console.log(chalk.yellow(sheet.title));
            }
        }

        if (sheetService.utterancesWorksheets.length > 0) {
            console.log(`processing ${chalk.yellow(sheetService.utterancesWorksheets.length)} UTTERANCE worksheet(s)...`);
            for (const sheet of sheetService.utterancesWorksheets) {
                console.log(chalk.yellow(sheet.title));
            }
        }

        if (sheetService.slotWorksheets.length > 0) {
            console.log(`processing ${chalk.yellow(sheetService.slotWorksheets.length)} SLOT worksheet(s)...`);
            for (const sheet of sheetService.slotWorksheets) {
                console.log(chalk.yellow(sheet.title));
            }
        }

        let json;

        if (argv.formatVersion === 4) {
            json = await converters.buildJovoModel4(argv, 
                sheetService.intentsWorksheets, 
                sheetService.utterancesWorksheets, 
                sheetService.slotWorksheets);
        } else {
            json = await converters.buildJovoModel(argv, 
                sheetService.intentsWorksheets, 
                sheetService.utterancesWorksheets, 
                sheetService.slotWorksheets);
        }

        const modelFullName = path.join(process.cwd(), argv.modelPath, `${sheetService.locale}.json`);
        console.log(chalk.green(modelFullName));
        writeFileSyncRecursive(modelFullName, JSON.stringify(json, null, 2));        

        if (sheetService.invocationNames.length > 0) {
            console.log(`processing ${chalk.yellow(sheetService.invocationNames.length)} INVOCATION_NAMES worksheet(s)...`);
            for (const sheet of sheetService.invocationNames) {
                const json = await converters.convertSheetToInvocationNameJSON(sheet, sheetService.locale);
                const fullName = getFilePath(sheet, '', argv.contentPath);
                console.log(chalk.yellow(sheet.title) + ' --> ' + chalk.green(fullName));
                writeFileSyncRecursive(fullName, JSON.stringify(json, null, 2));
            }
        }

        if (sheetService.viewsWorksheets.length > 0) {
            console.log(`processing ${chalk.yellow(sheetService.viewsWorksheets.length)} VIEWS_FILE worksheet(s)...`);
            for (const sheet of sheetService.viewsWorksheets) {
                let json;
                if (argv.formatVersion === 4) {
                    json = await converters.convertSheetToV4TranslationJSON(sheet);
                } else {
                    json = await converters.convertSheetToTranslationJSON(sheet);
                }

                const fullName = getFilePath(sheet, 'VIEWS_FILE@', argv.i18nPath, true);
                console.log(chalk.yellow(sheet.title) + ' --> ' + chalk.green(fullName));
                writeFileSyncRecursive(fullName, JSON.stringify(json, null, 2));
            }
        }

        if (sheetService.audiosWorksheets.length > 0) {
            console.log(`processing ${chalk.yellow(sheetService.audiosWorksheets.length)} AUDIOS_FILE worksheet(s)...`);
            for (const sheet of sheetService.audiosWorksheets) {
                const json = await converters.convertSheetToJSON(sheet);
                const fullName = getFilePath(sheet, '', argv.contentPath);
                console.log(chalk.yellow(sheet.title) + ' --> ' + chalk.green(fullName));
                writeFileSyncRecursive(fullName, JSON.stringify(json, null, 2));
            }
        }

        if (sheetService.downloadWorksheets.length > 0) {
            console.log(`processing ${chalk.yellow(sheetService.downloadWorksheets.length)} DOWNLOAD worksheet(s)...`);
            for (const sheet of sheetService.downloadWorksheets) {
                const json = await converters.convertSheetToJSON(sheet)
                const fullName = getFilePath(sheet, 'DOWNLOAD_', argv.contentPath);
                console.log(chalk.yellow(sheet.title) + ' --> ' + chalk.green(fullName));
                writeFileSyncRecursive(fullName, JSON.stringify(json, null, 2));
            }
        }

    }
}

function getFilePath(sheet, removeString, folderPath, keepCase=false) {
    const fileInfo = getFileInfo(sheet.title, removeString, keepCase);
    const rootPath = process.cwd();
    const fullName = path.join(rootPath, folderPath, fileInfo.locale, fileInfo.fileName);

    return fullName;
}

function getFileInfo(title, removeString, keepCase) {
    let fileName = _.replace(title, removeString, '');
    const parts = fileName.split('@');

    if (!keepCase) {
        parts[0] = _.kebabCase(parts[0]);
    }

    return {
        fileName: parts[0] + '.json',
        locale: parts[1] || '',
    }
    
}

function writeFileSyncRecursive(filename, content, charset = 'utf8') {
    const folders = filename.split(path.sep).slice(0, -1)
    if (folders.length) {
        // create folder path if it doesn't exist
        folders.reduce((last, folder) => {
            const folderPath = last ? last + path.sep + folder : folder
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath)
            }
            return folderPath
        })
    }
    fs.writeFileSync(filename, content, charset)
}