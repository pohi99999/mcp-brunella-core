const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'chatv1',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const createListRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateList', inputVars);
}
createListRef.operationName = 'CreateList';
exports.createListRef = createListRef;

exports.createList = function createList(dcOrVars, vars) {
  return executeMutation(createListRef(dcOrVars, vars));
};

const getPublicListsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetPublicLists');
}
getPublicListsRef.operationName = 'GetPublicLists';
exports.getPublicListsRef = getPublicListsRef;

exports.getPublicLists = function getPublicLists(dc) {
  return executeQuery(getPublicListsRef(dc));
};

const addMovieToListRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddMovieToList', inputVars);
}
addMovieToListRef.operationName = 'AddMovieToList';
exports.addMovieToListRef = addMovieToListRef;

exports.addMovieToList = function addMovieToList(dcOrVars, vars) {
  return executeMutation(addMovieToListRef(dcOrVars, vars));
};

const getMoviesInListRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMoviesInList', inputVars);
}
getMoviesInListRef.operationName = 'GetMoviesInList';
exports.getMoviesInListRef = getMoviesInListRef;

exports.getMoviesInList = function getMoviesInList(dcOrVars, vars) {
  return executeQuery(getMoviesInListRef(dcOrVars, vars));
};
