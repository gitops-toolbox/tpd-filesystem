function deletingDestination(template) {
  return template.template === null;
}

function destinationDoesNotExist(destinationStats) {
  return destinationStats instanceof Error;
}

module.exports = {
  deletingDestination,
  destinationDoesNotExist,
};
