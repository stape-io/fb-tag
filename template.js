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
const templateStorage = require('templateStorage');

// Call-once methods.
let gtmOnSuccess = () => {
  gtmOnSuccess = () => {};
  return data.gtmOnSuccess();
};

let gtmOnFailure = () => {
  gtmOnFailure = () => {};
  return data.gtmOnFailure();
};

/*==============================================================================
==============================================================================*/

const queueName = 'fbq';
const queue = getQueue(queueName);
const isConsentRevoked = data.enableConsentMode
  ? !isConsentGranted('ad_storage')
  : data.consent === false;
const isParamBuilderSdkEnabled = data.hasOwnProperty('enableParamBuilderSdk')
  ? data.enableParamBuilderSdk
  : true;
const PARTNER_NAME = 'stape-gtm-1.2.0' + (isParamBuilderSdkEnabled ? '-pb' : '');

setConsent(isConsentRevoked);
sendEvent(isConsentRevoked);
sendDataLayerPush();
runOnConsentGranted('ad_storage', isConsentRevoked, () => {
  loadScripts(isParamBuilderSdkEnabled);
});

if (isConsentRevoked) {
  // If consent is revoked, call gtmOnSuccess to avoid 'Still running' status.
  return gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function getQueue(queueName) {
  const q = copyFromWindow(queueName);
  if (q) return q;

  setInWindow(queueName, function () {
    const callMethod = copyFromWindow(queueName + '.callMethod.apply');
    if (callMethod) callInWindow(queueName + '.callMethod.apply', null, arguments);
    else callInWindow(queueName + '.queue.push', arguments);
  });

  aliasInWindow('_' + queueName, queueName);
  createQueue(queueName + '.queue');

  return copyFromWindow(queueName);
}

function setFbqConsent(command) {
  const queue = getQueue(queueName);
  if (command === 'revoke') {
    // Allows only one 'revoke' command at a time in the queue to avoid it being locked indefinitely.
    const queueHasRevokeCommand = (queue.queue || []).some(
      (item) => item[0] === 'consent' && item[1] === 'revoke'
    );
    if (queueHasRevokeCommand) return;
  }
  queue('consent', command);
}

function runOnConsentGranted(consentType, isConsentRevoked, callback) {
  if (data.enableConsentMode) {
    if (isConsentRevoked) {
      const callbacksKey = 'fbq_consent_callbacks_' + consentType;
      const callbacks = templateStorage.getItem(callbacksKey) || [];
      callbacks.push(callback);
      templateStorage.setItem(callbacksKey, callbacks);

      const listenerAddedKey = 'fbq_consent_listener_added_' + consentType;
      if (!templateStorage.getItem(listenerAddedKey)) {
        templateStorage.setItem(listenerAddedKey, true);
        addConsentListener(consentType, (type, granted) => {
          if (type !== consentType || !granted) return;
          const queuedCallbacks = templateStorage.getItem(callbacksKey) || [];
          templateStorage.setItem(callbacksKey, []);
          queuedCallbacks.forEach((cb) => cb());
        });
      }
    } else {
      callback();
    }
    return;
  }

  // Manual consent
  if (!isConsentRevoked) callback();
}

function setConsent(isConsentRevoked) {
  if (data.dpoLDU) {
    queue('dataProcessingOptions', ['LDU'], makeNumber(data.dpoCountry), makeNumber(data.dpoState));
  }

  if (isConsentRevoked) setFbqConsent('revoke');

  runOnConsentGranted('ad_storage', isConsentRevoked, () => {
    setFbqConsent('grant');
  });
}

function setSettings(pixelId) {
  if (data.disableAutoConfig) {
    queue('set', 'autoConfig', false, pixelId);
  }

  if (data.disablePushState) {
    setInWindow(queueName + '.disablePushState', true);
  }
}

function sendEvent(isConsentRevoked) {
  const initIds = copyFromWindow('_meta_gtm_ids') || [];
  const pixelIds = data.pixelIds;
  const eventName = getEventName();
  const command = getCommand(eventName);
  const eventData = getEventData(eventName);
  const userData = getUserData(isConsentRevoked);

  pixelIds.split(',').forEach((pixelId) => {
    const isNotInitialized = initIds.indexOf(pixelId) === -1;

    if (isNotInitialized) {
      initIds.push(pixelId);
      setInWindow('_meta_gtm_ids', initIds, true);
      setSettings(pixelId);
    }

    if (isNotInitialized || (data.enableEdvancedMatching && !data.runInitOnce)) {
      queue('init', pixelId, userData);
    }
    queue('set', 'agent', PARTNER_NAME, pixelId);
    queue(
      command,
      pixelId,
      eventName,
      eventData,
      data.eventId ? { eventID: data.eventId } : undefined
    );
  });
}

function getEventName() {
  if (data.inheritEventName === 'inherit') {
    let eventName = copyFromDataLayer('event');

    if (!eventName) {
      const ecommerceDataLayer = copyFromDataLayer('ecommerce', 1);
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

function getUserData(isConsentRevoked) {
  if (!data.enableEdvancedMatching) {
    return;
  }

  let userData = {};

  if (data.enableEventEnhancement) {
    userData = getEventEnhancement(isConsentRevoked);
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
    storeEventEnhancement(isConsentRevoked, userData);
  }

  return userData;
}

function getEventData(eventName) {
  let objectProperties = {};

  if (data.enableDataLayerMapping) {
    let ecommerce = getDL('ecommerce');
    if (getType(ecommerce) !== 'object') {
      ecommerce = {};
    }

    objectProperties = getUAEventData(eventName, objectProperties, ecommerce);

    if (!objectProperties.content_type) {
      objectProperties = getGA4EventData(eventName, objectProperties, ecommerce);
    }
  }

  if (getType(data.objectPropertiesFromVariable) === 'object') {
    mergeObjects(objectProperties, data.objectPropertiesFromVariable);
  }

  if (data.objectPropertiesList && data.objectPropertiesList.length) {
    objectProperties = mergeObjects(
      objectProperties,
      makeTableMap(data.objectPropertiesList, 'name', 'value')
    );
  }

  return objectProperties;
}

function getEventEnhancement(isConsentRevoked) {
  if (!isConsentRevoked && localStorage) {
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

    const normalizedValue = makeString(normalizeBasedOnSchemaKey(fieldName, value))
      .toLowerCase()
      .trim();
    if (canUseHashSync) {
      userDataHashed[fieldName] = callInWindow('dataTag256', normalizedValue, 'HEX');
    } else {
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

function storeEventEnhancement(isConsentRevoked, userData) {
  if (!isConsentRevoked && localStorage && objHasProps(userData)) {
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
  let email =
    userDataFrom.email ||
    userDataFrom.sha256_email_address ||
    userDataFrom.email_address ||
    userDataFrom.em;
  const emailType = getType(email);
  if (emailType === 'array' || emailType === 'object') email = email[0];
  if (email) userData.em = email;

  let phone =
    userDataFrom.phone ||
    userDataFrom.sha256_phone_number ||
    userDataFrom.phone_number ||
    userDataFrom.ph;
  const phoneType = getType(phone);
  if (phoneType === 'array' || phoneType === 'object') phone = phone[0];
  if (phone) userData.ph = phone;

  const firstName =
    userDataFrom.firstName ||
    userDataFrom.nameFirst ||
    userDataFrom.first_name ||
    userDataFrom.fn ||
    (userDataFrom.address && userDataFrom.address.sha256_first_name
      ? userDataFrom.address.sha256_first_name
      : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].sha256_first_name
      ? userDataFrom.address[0].sha256_first_name
      : undefined) ||
    (userDataFrom.address && userDataFrom.address.first_name
      ? userDataFrom.address.first_name
      : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].first_name
      ? userDataFrom.address[0].first_name
      : undefined);
  if (firstName) userData.fn = firstName;

  const lastName =
    userDataFrom.lastName ||
    userDataFrom.nameLast ||
    userDataFrom.last_name ||
    userDataFrom.ln ||
    (userDataFrom.address && userDataFrom.address.sha256_last_name
      ? userDataFrom.address.sha256_last_name
      : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].sha256_last_name
      ? userDataFrom.address[0].sha256_last_name
      : undefined) ||
    (userDataFrom.address && userDataFrom.address.last_name
      ? userDataFrom.address.last_name
      : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].last_name
      ? userDataFrom.address[0].last_name
      : undefined);
  if (lastName) userData.ln = lastName;

  if (userDataFrom.ge) userData.ge = userDataFrom.ge;
  if (userDataFrom.db) userData.db = userDataFrom.db;

  const city =
    userDataFrom.city ||
    userDataFrom.ct ||
    (userDataFrom.address && userDataFrom.address.city ? userDataFrom.address.city : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].city
      ? userDataFrom.address[0].city
      : undefined);
  if (city) userData.ct = city;

  const state =
    userDataFrom.state ||
    userDataFrom.region ||
    userDataFrom.st ||
    (userDataFrom.address && userDataFrom.address.state ? userDataFrom.address.state : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].state
      ? userDataFrom.address[0].state
      : undefined) ||
    (userDataFrom.address && userDataFrom.address.region
      ? userDataFrom.address.region
      : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].region
      ? userDataFrom.address[0].region
      : undefined);
  if (state) userData.st = state;

  const zip =
    userDataFrom.zip ||
    userDataFrom.postal_code ||
    userDataFrom.zp ||
    (userDataFrom.address && userDataFrom.address.postal_code
      ? userDataFrom.address.postal_code
      : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].postal_code
      ? userDataFrom.address[0].postal_code
      : undefined) ||
    (userDataFrom.address && userDataFrom.address.zip ? userDataFrom.address.zip : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].zip
      ? userDataFrom.address[0].zip
      : undefined);
  if (zip) userData.zp = zip;

  const country =
    userDataFrom.country ||
    (userDataFrom.address && userDataFrom.address.country
      ? userDataFrom.address.country
      : undefined) ||
    (userDataFrom.address && userDataFrom.address[0] && userDataFrom.address[0].country
      ? userDataFrom.address[0].country
      : undefined);
  if (country) userData.country = country;

  const externalId =
    userDataFrom.external_id ||
    userDataFrom.user_id ||
    userDataFrom.userId ||
    (useDL ? getDL('external_id') || getDL('user_id') || getDL('userId') || undefined : undefined);
  if (externalId) userData.external_id = externalId;

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

    if (
      ecommerce[action] &&
      ecommerce[action].products &&
      getType(ecommerce[action].products) === 'array'
    ) {
      objectProperties = {
        content_type: 'product',
        contents: ecommerce[action].products.map((prod) => ({
          id: prod.id,
          quantity: makeNumber(prod.quantity) || 1,
          item_price: makeNumber(prod.price)
        })),
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
  const items = getDL('items') || ecommerce.items;
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
      if (items[0].price)
        objectProperties.value = items[0].quantity
          ? items[0].quantity * items[0].price
          : items[0].price;
    }

    items.forEach((d) => {
      const content = {};
      if (d.item_id) content.id = d.item_id;
      content.quantity = makeNumber(d.quantity) || 1;

      if (d.price) {
        const item_price = makeNumber(d.price);
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

  const value = ecommerce.value || valueFromItems || getDL('value');
  if (value) objectProperties.value = value;

  const currency = ecommerce.currency || currencyFromItems || getDL('currency');
  if (currency) objectProperties.currency = currency;

  const searchTerm = getDL('search_term');
  if (searchTerm) objectProperties.search_string = searchTerm;

  if (eventName === 'Purchase') {
    if (!objectProperties.currency) objectProperties.currency = 'USD';
    if (!objectProperties.value) objectProperties.value = valueFromItems ? valueFromItems : 0;
  }

  return objectProperties;
}

function getDL(name) {
  const dataLayerVersion = data.enableCurrentDataLayerOnly ? 1 : 2;
  return copyFromDataLayer(name, dataLayerVersion);
}

function loadScripts(isParamBuilderSdkEnabled) {
  injectScript(
    'https://connect.facebook.net/en_US/fbevents.js',
    () => {
      setFbqConsent('grant'); // It needs to be called to unlock the queue after the SDK loads.
      return gtmOnSuccess();
    },
    gtmOnFailure,
    'metaPixel'
  );

  const isParamBuilderSdkLoadedOrLoading = !!copyFromWindow('_meta_param_builder_sdk_status');
  if (isParamBuilderSdkEnabled && !isParamBuilderSdkLoadedOrLoading && !isMagento2Checkout()) {
    setInWindow('_meta_param_builder_sdk_status', 'loading', true);
    injectScript(
      'https://unpkg.com/meta-capi-param-builder-clientjs/dist/clientParamBuilder.bundle.js',
      () => {
        setInWindow('_meta_param_builder_sdk_status', 'loaded', true);
        if (copyFromWindow('clientParamBuilder.processAndCollectAllParams')) {
          callInWindow('clientParamBuilder.processAndCollectAllParams');
        } else if (copyFromWindow('clientParamBuilder.processAndCollectParams')) {
          callInWindow('clientParamBuilder.processAndCollectParams');
        }
      },
      () => {
        setInWindow('_meta_param_builder_sdk_status', undefined, true);
      },
      'metaParamBuilderSdk'
    );
  }
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
  return makeString(phoneNumber)
    .split('+')
    .join('')
    .split(' ')
    .join('')
    .split('-')
    .join('')
    .split('(')
    .join('')
    .split(')')
    .join('');
}

function removeWhiteSpace(input) {
  if (!input) return input;
  return makeString(input).split(' ').join('');
}

function isMagento2Checkout() {
  const checkoutConfig = copyFromWindow('checkoutConfig');

  return (
    getType(checkoutConfig) === 'object' &&
    getType(checkoutConfig.quoteData) === 'object' &&
    checkoutConfig.hasOwnProperty('defaultSuccessPageUrl') &&
    checkoutConfig.hasOwnProperty('storeCode')
  );
}
