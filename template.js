const addConsentListener = require('addConsentListener');
const aliasInWindow = require('aliasInWindow');
const callInWindow = require('callInWindow');
const copyFromDataLayer = require('copyFromDataLayer');
const copyFromWindow = require('copyFromWindow');
const createQueue = require('createQueue');
const getType = require('getType');
const injectScript = require('injectScript');
const isConsentGranted = require('isConsentGranted');
const JSON = require('JSON');
const localStorage = require('localStorage');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const makeTableMap = require('makeTableMap');
const math = require('Math');
const Object = require('Object');
const setInWindow = require('setInWindow');
const sha256 = require('sha256');

/*==============================================================================
==============================================================================*/

const partnerName = 'stape-gtm';
const queueName = 'fbq';
const queue = getQueue(queueName);
const initIds = copyFromWindow('_meta_gtm_ids') || [];
const ecommerceDataLayer = copyFromDataLayer('ecommerce', 1);
const dataLayerVersion = data.enableCurrentDataLayerOnly ? 1 : 2;

setConsent();
sendEvent();
sendDataLayerPush();

injectScript('https://connect.facebook.net/en_US/fbevents.js', data.gtmOnSuccess, data.gtmOnFailure, 'metaPixel');

/*==============================================================================
  Vendor related functions
==============================================================================*/

function getQueue(queueName) {
  const q = copyFromWindow(queueName);
  if (q) {
    return q;
  }

  setInWindow(queueName, function () {
    const callMethod = copyFromWindow(queueName + '.callMethod.apply');
    if (callMethod) {
      callInWindow(queueName + '.callMethod.apply', null, arguments);
    } else {
      callInWindow(queueName + '.queue.push', arguments);
    }
  });

  aliasInWindow('_' + queueName, queueName);
  createQueue(queueName + '.queue');

  return copyFromWindow(queueName);
}

function setConsent() {
  if (data.dpoLDU) {
    queue('dataProcessingOptions', ['LDU'], makeNumber(data.dpoCountry), makeNumber(data.dpoState));
  }

  if (data.enableConsentMode) {
    if (!isConsentGranted('ad_storage')) {
      queue('consent', 'revoke');

      let wasCalled = false;

      addConsentListener('ad_storage', (consentType, granted) => {
        if (wasCalled || consentType !== 'ad_storage' || !granted) return;
        wasCalled = true;

        queue('consent', 'grant');
      });

      return;
    }

    queue('consent', 'grant');

    return;
  }

  queue('consent', data.consent === false ? 'revoke' : 'grant');
}

function setSettings(pixelId) {
  if (data.disableAutoConfig) {
    queue('set', 'autoConfig', false, pixelId);
  }

  if (data.disablePushState) {
    setInWindow(queueName + '.disablePushState', true);
  }
}

function sendEvent() {
  const pixelIds = data.pixelIds;
  const eventName = getEventName();
  const command = getCommand(eventName);
  const eventData = getEventData(eventName);
  const userData = getUserData();

  pixelIds.split(',').forEach((pixelId) => {
    if (initIds.indexOf(pixelId) === -1) {
      setSettings();

      initIds.push(pixelId);
      setInWindow('_meta_gtm_ids', initIds, true);
    }

    queue('init', pixelId, userData);
    queue('set', 'agent', partnerName, pixelId);

    if (data.eventId) {
      queue(command, pixelId, eventName, eventData, { eventID: data.eventId });
    } else {
      queue(command, pixelId, eventName, eventData);
    }
  });
}

function getEventName() {
  if (data.inheritEventName === 'inherit') {
    let eventName = copyFromDataLayer('event');

    if (!eventName) {
      if (ecommerceDataLayer.detail) eventName = 'ViewContent';
      else if (ecommerceDataLayer.add) eventName = 'AddToCart';
      else if (ecommerceDataLayer.checkout) eventName = 'InitiateCheckout';
      else if (ecommerceDataLayer.purchase) eventName = 'Purchase';
    }

    const mapFacebookEventName = {
      page_view: 'PageView',
      'gtm.dom': 'PageView',
      add_payment_info: 'AddPaymentInfo',
      add_to_cart: 'AddToCart',
      add_to_wishlist: 'AddToWishlist',
      sign_up: 'CompleteRegistration',
      begin_checkout: 'InitiateCheckout',
      generate_lead: 'Lead',
      purchase: 'Purchase',
      search: 'Search',
      view_item: 'ViewContent',

      contact: 'Contact',
      customize_product: 'CustomizeProduct',
      donate: 'Donate',
      find_location: 'FindLocation',
      schedule: 'Schedule',
      start_trial: 'StartTrial',
      submit_application: 'SubmitApplication',
      subscribe: 'Subscribe',

      page_view_stape: 'PageView',
      add_payment_info_stape: 'AddPaymentInfo',
      add_to_cart_stape: 'AddToCart',
      sign_up_stape: 'CompleteRegistration',
      begin_checkout_stape: 'InitiateCheckout',
      purchase_stape: 'Purchase',
      view_item_stape: 'ViewContent',

      'gtm4wp.addProductToCartEEC': 'AddToCart',
      'gtm4wp.productClickEEC': 'ViewContent',
      'gtm4wp.checkoutOptionEEC': 'InitiateCheckout',
      'gtm4wp.checkoutStepEEC': 'AddPaymentInfo',
      'gtm4wp.orderCompletedEEC': 'Purchase'
    };

    if (!mapFacebookEventName[eventName]) {
      return eventName;
    }

    return mapFacebookEventName[eventName];
  }

  return data.eventName === 'standard' ? data.eventNameStandard : data.eventNameCustom;
}

function getCommand(eventName) {
  return [
    'AddPaymentInfo',
    'AddToCart',
    'AddToWishlist',
    'CompleteRegistration',
    'Contact',
    'CustomizeProduct',
    'Donate',
    'FindLocation',
    'InitiateCheckout',
    'Lead',
    'PageView',
    'Purchase',
    'Schedule',
    'Search',
    'StartTrial',
    'SubmitApplication',
    'Subscribe',
    'ViewContent'
  ].indexOf(eventName) === -1
    ? 'trackSingleCustom'
    : 'trackSingle';
}

function getUserData() {
  if (!data.enableEdvancedMatching) {
    return;
  }

  let userData = {};

  if (data.enableEventEnhancement) {
    userData = getEventEnhancement(userData);
  }

  if (data.enableDataLayerMapping) {
    let userDataFromDataLayer = getDL('user_data');

    if (getType(userDataFromDataLayer) === 'object') {
      parseUserData(userData, userDataFromDataLayer, true);
    }
  }

  if (getType(data.userDataFromVariable) === 'object') {
    parseUserData(userData, data.userDataFromVariable, false);
  }

  if (data.userDataList && data.userDataList.length) {
    userData = mergeObjects(userData, makeTableMap(data.userDataList, 'name', 'value'));
  }

  if (objIsEmptyOrContainsOnlyFalsyValues(userData)) {
    return;
  }

  if (data.enableEventEnhancement) {
    storeEventEnhancement(userData);
  }

  return userData;
}

function getEventData(eventName) {
  let objectProperties = {};

  if (data.enableDataLayerMapping) {
    const ecommerce = getDL('ecommerce');

    if (ecommerce) {
      objectProperties = getUAEventData(eventName, objectProperties, ecommerce);
    }
    if (!objectProperties.content_type) {
      objectProperties = getGA4EventData(eventName, objectProperties, ecommerce);
    }
  }

  if (getType(data.objectPropertiesFromVariable) === 'object') {
    mergeObjects(objectProperties, data.objectPropertiesFromVariable);
  }

  if (data.objectPropertiesList && data.objectPropertiesList.length) {
    objectProperties = mergeObjects(objectProperties, makeTableMap(data.objectPropertiesList, 'name', 'value'));
  }

  return objectProperties;
}

function getEventEnhancement() {
  if (localStorage) {
    const gtmeec = localStorage.getItem('gtmeec');

    if (gtmeec) {
      const gtmeecParsed = JSON.parse(gtmeec);

      if (getType(gtmeecParsed) === 'object') {
        return gtmeecParsed;
      }
    }
  }

  return {};
}

function normalizeBasedOnSchemaKey(schemaKey, identifier) {
  if (schemaKey === 'ph') return normalizePhoneNumber(identifier);
  else if (schemaKey === 'ct' || schemaKey === 'st' || schemaKey === 'zp') {
    return removeWhiteSpace(identifier);
  } else return identifier;
}

function hashUserDataFields(userData, storeUserDataInLocalStorage) {
  const canUseHashSync = getType(copyFromWindow('dataTag256')) === 'function';
  const hashAsyncHelpers = {
    pendingHashs: 0,
    maybeFinish: (userDataHashed) => {
      if (hashAsyncHelpers.pendingHashs === 0) storeUserDataInLocalStorage(userDataHashed);
    }
  };

  const userDataHashed = {};

  const fieldNames = Object.keys(userData);
  fieldNames.forEach((fieldName) => {
    const value = userData[fieldName];

    if (value === undefined || value === null || value === '') return;
    if (isHashed(value)) {
      userDataHashed[fieldName] = value;
      return;
    }

    const normalizedValue = makeString(normalizeBasedOnSchemaKey(fieldName, value)).toLowerCase().trim();
    if (canUseHashSync) userDataHashed[fieldName] = callInWindow('dataTag256', normalizedValue, 'HEX');
    else {
      hashAsyncHelpers.pendingHashs++;
      sha256(
        normalizedValue,
        (digest) => {
          userDataHashed[fieldName] = digest;
          hashAsyncHelpers.pendingHashs--;
          hashAsyncHelpers.maybeFinish(userDataHashed);
        },
        () => {
          hashAsyncHelpers.pendingHashs--;
        },
        { outputEncoding: 'hex' }
      );
    }
  });

  if (canUseHashSync) {
    storeUserDataInLocalStorage(userDataHashed);
    return userDataHashed;
  } else {
    hashAsyncHelpers.maybeFinish(userDataHashed);
    return;
  }
}

function storeUserDataInLocalStorage(userData) {
  if (!objHasProps(userData)) return;
  const gtmeec = JSON.stringify(userData);
  localStorage.setItem('gtmeec', gtmeec);
}

function storeEventEnhancement(userData) {
  if (localStorage && objHasProps(userData)) {
    if (!data.storeUserDataHashed) storeUserDataInLocalStorage(userData);
    else hashUserDataFields(userData, storeUserDataInLocalStorage);
  }
}

function sendDataLayerPush() {
  if (data.dataLayerEventPush) {
    const dataLayerQueueName = data.dataLayerVariableName || 'dataLayer';
    const dataLayerPush = createQueue(dataLayerQueueName);

    dataLayerPush({ eventId: data.eventId, event: data.dataLayerEventName || 'DefaultTagEvent' });
  }
}

function parseUserData(userData, userDataFrom, useDL) {
  let email = userDataFrom.email || userDataFrom.sha256_email_address || userDataFrom.email_address || userDataFrom.em;
  const emailType = getType(email);
  if (emailType === 'array' || emailType === 'object') email = email[0];
  if (email) userData.em = email;

  let phone = userDataFrom.phone || userDataFrom.sha256_phone_number || userDataFrom.phone_number || userDataFrom.ph;
  const phoneType = getType(phone);
  if (phoneType === 'array' || phoneType === 'object') phone = phone[0];
  if (phone) userData.ph = phone;

  if (userDataFrom.firstName) userData.fn = userDataFrom.firstName;
  else if (userDataFrom.nameFirst) userData.fn = userDataFrom.nameFirst;
  else if (userDataFrom.first_name) userData.fn = userDataFrom.first_name;
  else if (userDataFrom.fn) userData.fn = userDataFrom.fn;
  else if (userDataFrom.address && userDataFrom.address.sha256_first_name) userData.fn = userDataFrom.address.sha256_first_name;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].sha256_first_name) userData.fn = userDataFrom.address[0].sha256_first_name;
  else if (userDataFrom.address && userDataFrom.address.first_name) userData.fn = userDataFrom.address.first_name;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].first_name) userData.fn = userDataFrom.address[0].first_name;

  if (userDataFrom.lastName) userData.ln = userDataFrom.lastName;
  else if (userDataFrom.nameLast) userData.ln = userDataFrom.nameLast;
  else if (userDataFrom.last_name) userData.ln = userDataFrom.last_name;
  else if (userDataFrom.ln) userData.ln = userDataFrom.ln;
  else if (userDataFrom.address && userDataFrom.address.sha256_last_name) userData.ln = userDataFrom.address.sha256_last_name;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].sha256_last_name) userData.ln = userDataFrom.address[0].sha256_last_name;
  else if (userDataFrom.address && userDataFrom.address.last_name) userData.ln = userDataFrom.address.last_name;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].last_name) userData.ln = userDataFrom.address[0].last_name;

  if (userDataFrom.ge) userData.ge = userDataFrom.ge;
  if (userDataFrom.db) userData.db = userDataFrom.db;

  if (userDataFrom.city) userData.ct = userDataFrom.city;
  else if (userDataFrom.ct) userData.ct = userDataFrom.ct;
  else if (userDataFrom.address && userDataFrom.address.city) userData.ct = userDataFrom.address.city;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].city) userData.ct = userDataFrom.address[0].city;

  if (userDataFrom.state) userData.st = userDataFrom.state;
  else if (userDataFrom.region) userData.st = userDataFrom.region;
  else if (userDataFrom.st) userData.st = userDataFrom.st;
  else if (userDataFrom.address && userDataFrom.address.state) userData.st = userDataFrom.address.state;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].state) userData.st = userDataFrom.address[0].state;
  else if (userDataFrom.address && userDataFrom.address.region) userData.st = userDataFrom.address.region;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].region) userData.st = userDataFrom.address[0].region;

  if (userDataFrom.zip) userData.zp = userDataFrom.zip;
  else if (userDataFrom.postal_code) userData.zp = userDataFrom.postal_code;
  else if (userDataFrom.zp) userData.zp = userDataFrom.zp;
  else if (userDataFrom.address && userDataFrom.address.postal_code) userData.zp = userDataFrom.address.postal_code;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].postal_code) userData.zp = userDataFrom.address[0].postal_code;
  else if (userDataFrom.address && userDataFrom.address.zip) userData.zp = userDataFrom.address.zip;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].zip) userData.zp = userDataFrom.address[0].zip;

  if (userDataFrom.country) userData.country = userDataFrom.country;
  else if (userDataFrom.address && userDataFrom.address.country) userData.country = userDataFrom.address.country;
  else if (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].country) userData.country = userDataFrom.address[0].country;

  if (userDataFrom.external_id) userData.external_id = userDataFrom.external_id;
  else if (userDataFrom.user_id) userData.external_id = userDataFrom.user_id;
  else if (userDataFrom.userId) userData.external_id = userDataFrom.userId;
  else if (useDL && getDL('external_id')) userData.external_id = getDL('external_id');
  else if (useDL && getDL('user_id')) userData.external_id = getDL('user_id');
  else if (useDL && getDL('userId')) userData.external_id = getDL('userId');

  return userData;
}

function getUAEventData(eventName, objectProperties, ecommerce) {
  const eventActionMap = {
    ViewContent: 'detail',
    AddToCart: 'add',
    InitiateCheckout: 'checkout',
    Purchase: 'purchase'
  };

  if (eventActionMap[eventName]) {
    const action = eventActionMap[eventName];

    if (ecommerce[action] && ecommerce[action].products && getType(ecommerce[action].products) === 'array') {
      objectProperties = {
        content_type: 'product',
        contents: ecommerce[action].products.map((prod) => ({ id: prod.id, quantity: makeNumber(prod.quantity) || 1, item_price: makeNumber(prod.price) })),
        content_ids: ecommerce[action].products.map((prod) => prod.id),
        value: ecommerce[action].products.reduce((acc, cur) => {
          const curVal = math.round(makeNumber(cur.price || 0) * (cur.quantity || 1) * 100) / 100;
          return acc + curVal;
        }, 0.0),
        currency: ecommerce.currencyCode || 'USD'
      };

      if (['InitiateCheckout', 'Purchase'].indexOf(eventName) > -1)
        objectProperties.num_items = ecommerce[action].products.reduce((acc, cur) => {
          return acc + makeNumber(cur.quantity || 1);
        }, 0);
    }
  }

  return objectProperties;
}

function getGA4EventData(eventName, objectProperties, ecommerce) {
  let items = getDL('items');
  if (!items && ecommerce && ecommerce.items) {
    items = ecommerce.items;
  }
  let currencyFromItems = '';
  let valueFromItems = 0;

  if (items && items[0]) {
    objectProperties.contents = [];
    objectProperties.content_ids = [];
    objectProperties.content_type = 'product';
    if (['InitiateCheckout', 'Purchase'].indexOf(eventName) > -1) {
      objectProperties.num_items = 0;
    }
    currencyFromItems = items[0].currency;

    if (!items[1]) {
      if (items[0].item_name) objectProperties.content_name = items[0].item_name;
      if (items[0].item_category) objectProperties.content_category = items[0].item_category;
      if (items[0].price) objectProperties.value = items[0].quantity ? items[0].quantity * items[0].price : items[0].price;
    }

    items.forEach((d, i) => {
      const content = {};
      if (d.item_id) content.id = d.item_id;
      content.quantity = makeNumber(d.quantity) || 1;

      if (d.price) {
        let item_price = makeNumber(d.price);
        valueFromItems += d.quantity ? d.quantity * item_price : item_price;
        content.item_price = item_price;
      }

      objectProperties.contents.push(content);
      objectProperties.content_ids.push(content.id);
      if (['InitiateCheckout', 'Purchase'].indexOf(eventName) > -1) {
        objectProperties.num_items = objectProperties.num_items + content.quantity || 1;
      }
    });
  }

  if (getDL('value')) objectProperties.value = getDL('value');

  if (getDL('currency')) objectProperties.currency = getDL('currency');
  else if (currencyFromItems) objectProperties.currency = currencyFromItems;

  if (getDL('search_term')) objectProperties.search_string = getDL('search_term');

  if (eventName === 'Purchase') {
    if (!objectProperties.currency) objectProperties.currency = 'USD';
    if (!objectProperties.value) objectProperties.value = valueFromItems ? valueFromItems : 0;
  }

  return objectProperties;
}

function getDL(name) {
  return copyFromDataLayer(name, dataLayerVersion);
}

/*==============================================================================
  Helpers
==============================================================================*/

function mergeObjects(obj1, obj2) {
  Object.keys(obj2).forEach((key) => {
    obj1[key] = obj2[key];
  });

  return obj1;
}

function objHasProps(obj) {
  return getType(obj) === 'object' && Object.keys(obj).length > 0;
}

function objIsEmptyOrContainsOnlyFalsyValues(obj) {
  if (getType(obj) !== 'object') return;
  const objValues = Object.values(obj);
  if (objValues.length === 0 || objValues.every((v) => !v)) return true;
}

function isHashed(value) {
  if (!value) return false;
  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return phoneNumber;
  return phoneNumber.split('+').join('').split(' ').join('').split('-').join('').split('(').join('').split(')').join('');
}

function removeWhiteSpace(input) {
  if (!input) return input;
  return input.split(' ').join('');
}
