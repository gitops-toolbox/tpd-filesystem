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
    this.interactive = args.interactive;
  }

  isValid(template) {
    return (
      template.template !== undefined &&
      template.destination &&
      template.destination.type &&
      template.destination.type === 'tpd-filesystem' &&
      template.destination.params &&
      template.destination.params.baseDir &&
      template.destination.params.filepath &&
      (template.template == null || template.renderedTemplate)
    );
  }

  filterInvalid() {
    let invalid = [];
    for (const template of this.templates) {
      if (!this.isValid(template)) {
        this.logger('Template %o is missing one or more properties', template);
        invalid.push(template);
      }
    }

    return invalid;
  }

  _path_stats(filepath) {
    const destination = path.resolve(this.baseDir, filepath);
    this.logger(`Checking for ${destination}`);
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

      if (!this.isValid(template)) {
        action = 'mark_invalid';
        message = 'one or more properties missing';
      } else if (!fs.existsSync(baseDir)) {
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
    this.logger(action);

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
    const messages = {
      to_reject: 'The above files cannot be created because of missing BaseDir',
      to_update: 'The above files content will be updated',
      to_delete: 'The above files will be deleted',
      to_create: 'The above files will be created',
      to_ignore: 'The above are ignored because deleting non existent files',
    };

    for (const [type, action] of Object.entries(actions)) {
      this.logger(type);
      await this._ask_confirmation(action, messages[type]);
    }
  }

  _delete(destination, template) {
    this.logger('Deleting %s for template %j', destination, template);
    try {
      fs.unlinkSync(destination);
    } catch (e) {
      this.logger('Cannot delete file %s', destination);
      throw e;
    }
  }

  _create_baseDir(destination) {
    try {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
    } catch (e) {
      this.logger('Something went wrong creating directory %o', e);
      throw e;
    }
  }

  _create_or_update(destination, template) {
    this.logger(destination, template);
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
    for (const [type, destination_to_template] of Object.entries(actions)) {
      if (type === 'to_reject') {
        continue;
      }

      for (const [destination, params] of Object.entries(
        destination_to_template
      )) {
        if (type === 'to_delete') {
          this._delete(destination, params.template);
        }

        if (type === 'to_create') {
          this._create_baseDir(destination);
        }

        if (type === 'to_update' || type === 'to_create') {
          this._create_or_update(destination, params.template);
        }
      }
    }
  }

  async persist() {
    this.filterInvalid();
    const actions = await this._prepare_actions();
    await this._ask_confirmations(actions);
    await this._apply(actions);
    return actions;
  }
}

module.exports = Filesystem;
