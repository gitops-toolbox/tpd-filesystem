const fs = require('fs');
const path = require('path');
const prompts = require('prompts');
const chalk = require('chalk');
const utils = require('./utils');

class Filesystem {
  constructor(templates, logger, args) {
    this.templates = templates;
    this.baseDir = args.baseDir;
    this.logger = logger;
    this.interactive = args.interactive === undefined ? true : args.interactive;
  }

  isValid(template) {
    const logger = this.logger.extend('isValid');
    const result =
      template.template !== undefined &&
      template.destination &&
      template.destination.type &&
      template.destination.type === 'tpd-filesystem' &&
      template.destination.params &&
      template.destination.params.baseDir &&
      template.destination.params.filepath &&
      (template.template == null ||
        template.renderedTemplate != undefined ||
        template.renderedTemplate != null);
    logger('Template %j is %s', template, result ? 'valid' : 'invalid');
    return result;
  }

  filterInvalid() {
    const logger = this.logger.extend('filterInvalid');
    let invalid = [];
    for (const template of this.templates) {
      if (!this.isValid(template)) {
        logger('Template %o is missing one or more properties', template);
        invalid.push(template);
      }
    }

    return invalid;
  }

  _path_stats(filepath) {
    const logger = this.logger.extend('_path_stats');
    const destination = path.resolve(this.baseDir, filepath);

    logger(`Checking for ${destination}`);
    try {
      return fs.statSync(destination);
    } catch (e) {
      return e;
    }
  }

  async _prepare_actions() {
    const templates = this.templates;
    const actions = {
      to_reject: {},
      to_delete: {},
      to_update: {},
      to_create: {},
      to_ignore: {},
      mark_invalid: {},
    };

    for (const template of templates) {
      const params = template.destination.params;
      const baseDir = path.resolve(this.baseDir, params.baseDir);
      const destination = path.resolve(baseDir, params.filepath);

      let action = null;
      let message = undefined;

      const destinationStats = this._path_stats(destination);

      if (!fs.existsSync(baseDir)) {
        action = 'to_reject';
        message = `${baseDir} does not exist`;
      } else if (
        utils.deletingDestination(template) &&
        !fs.existsSync(destination)
      ) {
        action = 'to_ignore';
        message = 'does not exist';
      } else if (!fs.existsSync(destination)) {
        action = 'to_create';
      } else if (destinationStats.isDirectory()) {
        action = 'to_reject';
        message = `seems to be a directory`;
      } else if (utils.deletingDestination(template)) {
        action = 'to_delete';
      } else {
        action = 'to_update';
      }

      actions[action][destination] = {
        template,
        message,
      };
    }
    return actions;
  }

  async _ask_confirmation(action, message) {
    const logger = this.logger.extend('_ask_confirmation');

    logger(action);

    if (Object.keys(action).length > 0) {
      for (const [destination, value] of Object.entries(action)) {
        console.log(chalk.blueBright(destination), value.message || '');
      }
      console.log(chalk.red(message));

      if (!this.interactive) {
        return;
      }

      await prompts(
        {
          type: 'text',
          name: 'continue',
          message: 'Press any key to continue, CRTL^C to stop',
        },
        { onCancel: () => process.exit(1) }
      );
    }
  }

  async _ask_confirmations(actions) {
    const logger = this.logger.extend('_ask_confirmations');
    const messages = {
      to_reject: 'The above files cannot be created because of missing BaseDir',
      to_update: 'The above files content will be updated',
      to_delete: 'The above files will be deleted',
      to_create: 'The above files will be created',
      to_ignore: 'The above are ignored because deleting non existent files',
    };

    for (const [type, action] of Object.entries(actions)) {
      logger(type);
      await this._ask_confirmation(action, messages[type]);
    }
  }

  _create_or_update(destination, template) {
    const logger = this.logger.extend('_create_or_update');
    logger(destination, template);
    const params = template.destination.params;
    const options = {
      encoding: params.encoding,
      mode: params.mode !== undefined ? parseInt(params.mode, 8) : undefined,
    };

    this.logger(
      'Creating %s file with following params %j',
      destination,
      options
    );

    fs.writeFileSync(destination, template.renderedTemplate, options);
  }

  async _apply(actions) {
    const logger = this.logger.extend('_apply');
    const result_by_destination = {
      deleted: [],
      failed_to_delete: [],
      created: [],
      failed_to_create: [],
      updated: [],
      failed_to_update: [],
      rejected: [],
    };
    for (const [type, destination_to_template] of Object.entries(actions)) {
      for (const [destination, params] of Object.entries(
        destination_to_template
      )) {
        if (type === 'to_reject') {
          result_by_destination.rejected.push(destination);
          continue;
        }

        if (type === 'to_delete') {
          try {
            fs.unlinkSync(destination);
            result_by_destination.deleted.push(destination);
          } catch (e) {
            logger('Cannot delete file %s', destination);
            result_by_destination[`failed_${type}`].push({
              destination,
              message: e.message,
            });
          }
        }

        if (type === 'to_create') {
          try {
            fs.mkdirSync(path.dirname(destination), { recursive: true });
          } catch (e) {
            logger('Something went wrong creating directory %o', e);
            result_by_destination[`failed_${type}`].push({
              destination,
              message: e.message,
            });
            continue;
          }
        }

        if (type === 'to_update' || type === 'to_create') {
          try {
            this._create_or_update(destination, params.template);
            result_by_destination[
              type == 'to_create' ? 'created' : 'updated'
            ].push(destination);
          } catch (e) {
            result_by_destination[`failed_${type}`].push({
              destination,
              message: e.message,
            });
          }
        }
      }
    }
    return result_by_destination;
  }

  async persist() {
    const invalid = this.filterInvalid();
    if (invalid.length > 0) {
      return {
        invalidTemplates: invalid,
      };
    }

    const actions = await this._prepare_actions();
    await this._ask_confirmations(actions);
    return await this._apply(actions);
  }
}

module.exports = Filesystem;
