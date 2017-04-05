'use strict';

const fs = require('fs');
const url = require('url');
var formidable = require('formidable');
const settings = require('../../lib/settings');
var mongo = require('../../lib/mongo');
var parse = require('../../lib/parse');

class SettingsService {
  constructor() {
    this.defaultSettings = {
      'logo_file': null,
      'language': 'en',
      'currency_code': 'USD',
      'currency_symbol': '$',
      'currency_format': '${amount}',
      'thousand_separator': ',',
      'decimal_separator': '.',
      'decimal_number': 2,
      'timezone': 'Asia/Singapore',
      'date_format': 'MMMM D, YYYY',
      'time_format': 'h:mm a',
      'default_shipping_country': 'SG',
      'default_shipping_state': '',
      'default_shipping_city': '',
      'default_product_sorting': 'stock_status,price,position',
      'weight_unit': 'kg',
      'length_unit': 'cm'
    }
  }

  getSettings() {
    return mongo.db.collection('settings').findOne().then(settings => {
      return this.changeProperties(settings);
    });
  }

  updateSettings(data) {
    const settings = this.getValidDocumentForUpdate(data);
    return this.insertDefaultSettingsIfEmpty().then(() => mongo.db.collection('settings').updateOne({}, {
      $set: settings
    }, {upsert: true}).then(res => this.getSettings()));
  }

  insertDefaultSettingsIfEmpty() {
    return mongo.db.collection('settings').count().then(count => {
      if (count === 0) {
        return mongo.db.collection('settings').insertOne(this.defaultSettings);
      } else {
        return;
      }
    });
  }

  getValidDocumentForUpdate(data) {
    if (Object.keys(data).length === 0) {
      return new Error('Required fields are missing');
    }

    let settings = {}

    if (data.language !== undefined) {
      settings.language = parse.getString(data.language);
    }

    if (data.currency_code !== undefined) {
      settings.currency_code = parse.getString(data.currency_code);
    }

    if (data.currency_symbol !== undefined) {
      settings.currency_symbol = parse.getString(data.currency_symbol);
    }

    if (data.currency_format !== undefined) {
      settings.currency_format = parse.getString(data.currency_format);
    }

    if (data.thousand_separator !== undefined) {
      settings.thousand_separator = parse.getString(data.thousand_separator);
    }

    if (data.decimal_separator !== undefined) {
      settings.decimal_separator = parse.getString(data.decimal_separator);
    }

    if (data.decimal_number !== undefined) {
      settings.decimal_number = parse.getNumberIfPositive(data.decimal_number) || 2;
    }

    if (data.timezone !== undefined) {
      settings.timezone = parse.getString(data.timezone);
    }

    if (data.date_format !== undefined) {
      settings.date_format = parse.getString(data.date_format);
    }

    if (data.time_format !== undefined) {
      settings.time_format = parse.getString(data.time_format);
    }

    if (data.default_shipping_country !== undefined) {
      settings.default_shipping_country = parse.getString(data.default_shipping_country);
    }

    if (data.default_shipping_state !== undefined) {
      settings.default_shipping_state = parse.getString(data.default_shipping_state);
    }

    if (data.default_shipping_city !== undefined) {
      settings.default_shipping_city = parse.getString(data.default_shipping_city);
    }

    if (data.default_product_sorting !== undefined) {
      settings.default_product_sorting = parse.getString(data.default_product_sorting);
    }

    if (data.weight_unit !== undefined) {
      settings.weight_unit = parse.getString(data.weight_unit);
    }

    if (data.length_unit !== undefined) {
      settings.length_unit = parse.getString(data.length_unit);
    }

    if (data.logo_file !== undefined) {
      settings.logo_file = parse.getString(data.logo_file);
    }

    return settings;
  }

  changeProperties(data) {
    if (data) {
      delete data._id;
      data.logo = (data.logo_file && data.logo_file.length > 0) ? settings.url.files + '/' + data.logo_file : null;
      return data;
    } else {
      return this.defaultSettings;
    }
  }

  deleteLogo() {
    return this.getSettings().then(data => {
      if(data.logo_file && data.logo_file.length > 0) {
        let filePath = settings.path.files + '/' + data.logo_file;
        fs.unlink(filePath, (err) => {
          this.updateSettings({ 'logo_file': null });
        })
      }
    })
  }

  uploadLogo(req, res, next) {
    let form = new formidable.IncomingForm(),
        file_name = null,
        file_size = 0;

    form
      .on('fileBegin', (name, file) => {
        // Emitted whenever a field / value pair has been received.
        file.path = settings.path.files + '/' + file.name;
      })
      .on('file', function(field, file) {
        // every time a file has been uploaded successfully,
        file_name = file.name;
        file_size = file.size;
      })
      .on('error', (err) => {
        res.status(500).send(this.getErrorMessage(err));
      })
      .on('end', () => {
        //Emitted when the entire request has been received, and all contained files have finished flushing to disk.
        if(file_name) {
          this.updateSettings({ 'logo_file': file_name });
          res.send({ 'file': file_name, 'size': file_size });
        } else {
          res.status(400).send(this.getErrorMessage('Required fields are missing'));
        }
      });

    form.parse(req);
  }

  getErrorMessage(err) {
    return { 'error': true, 'message': err.toString() };
  }
}

module.exports = new SettingsService();
