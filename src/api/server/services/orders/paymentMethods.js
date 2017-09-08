'use strict';

var mongo = require('../../lib/mongo');
var utils = require('../../lib/utils');
var parse = require('../../lib/parse');
var ObjectID = require('mongodb').ObjectID;
var PaymentMethodsLightService = require('./paymentMethodsLight');
var OrdersService = require('./orders');

class PaymentMethodsService {
  constructor() {}

  getFilter(params = {}) {
    return new Promise((resolve, reject) => {
      let filter = {};
      const id = parse.getObjectIDIfValid(params.id);
      const enabled = parse.getBooleanIfValid(params.enabled);

      if (id) {
        filter._id = new ObjectID(id);
      }

      if (enabled !== null) {
        filter.enabled = enabled;
      }

      const order_id = parse.getObjectIDIfValid(params.order_id);

      if (order_id) {
        return OrdersService.getSingleOrder(order_id).then(order => {
          if (order) {
            const shippingMethodObjectID = parse.getObjectIDIfValid(order.shipping_method_id);

            filter['$and'] = [];
            filter['$and'].push({
              $or: [
                {
                  'conditions.subtotal_min': 0
                }, {
                  'conditions.subtotal_min': {
                    $lte: order.subtotal
                  }
                }
              ]
            });
            filter['$and'].push({
              $or: [
                {
                  'conditions.subtotal_max': 0
                }, {
                  'conditions.subtotal_max': {
                    $gte: order.subtotal
                  }
                }
              ]
            });

            if (order.shipping_address.country && order.shipping_address.country.length > 0) {
              filter['$and'].push({
                $or: [
                  {
                    'conditions.countries': {
                      $size: 0
                    }
                  }, {
                    'conditions.countries': order.shipping_address.country
                  }
                ]
              });
            }

            if (shippingMethodObjectID) {
              filter['$and'].push({
                $or: [
                  {
                    'conditions.shipping_method_ids': {
                      $size: 0
                    }
                  }, {
                    'conditions.shipping_method_ids': shippingMethodObjectID
                  }
                ]
              });
            }
          }
          resolve(filter);
        })
      } else {
        resolve(filter);
      }
    });
  }

  getMethods(params = {}) {
    return this.getFilter(params).then(filter => {
      return PaymentMethodsLightService.getMethods(filter);
    });
  }

  getSingleMethod(id) {
    if (!ObjectID.isValid(id)) {
      return Promise.reject('Invalid identifier');
    }
    return this.getMethods({id: id}).then(methods => {
      return methods.length > 0
        ? methods[0]
        : null;
    })
  }

  addMethod(data) {
    const method = this.getValidDocumentForInsert(data);
    return mongo.db.collection('paymentMethods').insertMany([method]).then(res => this.getSingleMethod(res.ops[0]._id.toString()));
  }

  updateMethod(id, data) {
    if (!ObjectID.isValid(id)) {
      return Promise.reject('Invalid identifier');
    }
    const methodObjectID = new ObjectID(id);
    const method = this.getValidDocumentForUpdate(id, data);

    return mongo.db.collection('paymentMethods').updateOne({
      _id: methodObjectID
    }, {$set: method}).then(res => this.getSingleMethod(id));
  }

  deleteMethod(id) {
    if (!ObjectID.isValid(id)) {
      return Promise.reject('Invalid identifier');
    }
    const methodObjectID = new ObjectID(id);
    return mongo.db.collection('paymentMethods').deleteOne({'_id': methodObjectID}).then(deleteResponse => {
      return deleteResponse.deletedCount > 0;
    });
  }

  getPaymentMethodConditions(conditions) {
    let methodIds = conditions ? parse.getArrayIfValid(conditions.shipping_method_ids) || [] : [];
    let methodObjects = [];
    if(methodIds.length > 0){
      methodObjects = methodIds.map(id => new ObjectID(id));
    }

    return conditions
      ? {
        'countries': parse.getArrayIfValid(conditions.countries) || [],
        'shipping_method_ids': methodObjects,
        'subtotal_min': parse.getNumberIfPositive(conditions.subtotal_min) || 0,
        'subtotal_max': parse.getNumberIfPositive(conditions.subtotal_max) || 0
      }
      : {
        'countries': [],
        'shipping_method_ids': [],
        'subtotal_min': 0,
        'subtotal_max': 0
      };
  }

  getValidDocumentForInsert(data) {
    let method = {};

    method.name = parse.getString(data.name);
    method.description = parse.getString(data.description);
    method.position = parse.getNumberIfPositive(data.position) || 0;
    method.enabled = parse.getBooleanIfValid(data.enabled, true);
    method.conditions = this.getPaymentMethodConditions(data.conditions);
    method.gateway = parse.getString(data.gateway);
    method.gateway_settings = data.gateway_settings;

    return method;
  }

  getValidDocumentForUpdate(id, data) {
    if (Object.keys(data).length === 0) {
      return new Error('Required fields are missing');
    }

    let method = {}

    if (data.name !== undefined) {
      method.name = parse.getString(data.name);
    }

    if (data.description !== undefined) {
      method.description = parse.getString(data.description);
    }

    if (data.position !== undefined) {
      method.position = parse.getNumberIfPositive(data.position) || 0;
    }

    if (data.enabled !== undefined) {
      method.enabled = parse.getBooleanIfValid(data.enabled, true);
    }

    if (data.conditions !== undefined) {
      method.conditions = this.getPaymentMethodConditions(data.conditions);
    }

    if (data.gateway !== undefined) {
      method.gateway = parse.getString(data.gateway);
    }

    if (data.gateway_settings !== undefined) {
      method.gateway_settings = data.gateway_settings;
    }

    return method;
  }
}

module.exports = new PaymentMethodsService();
