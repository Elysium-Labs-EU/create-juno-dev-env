'use-strict';

const { prompt } = require('prompts');
const path = require('path');

let interval;
function cleanup() {
  clearInterval(interval);
}

async function checkSetupVariables() {
  const root = path.resolve();
  const questions = [
    {
      type: 'confirm',
      name: 'userHasForked',
      message: 'Have you forked the frontend already?',
    },
    {
      type: (prev) => (prev === true ? 'text' : null),
      name: 'forkFolderLocation',
      message: `What is the fork folder location? ${root}/ ...`,
      validate: (v) => (!v.startsWith('/')
        ? true
        : 'Please enter folder location without starting /'),
    },
    {
      type: (prev) => (prev ? 'select' : null),
      name: 'cloudOrLocalVersion',
      message: 'How do you want to connect the frontend?',
      choices: [
        {
          value: 'cloud',
          title: 'Cloud version',
          description:
            'Make use of the hosted version of the backend by Elysium Labs',
        },
        {
          value: 'local',
          title: 'Local version',
          description: 'Setup the backend yourself',
        },
      ],
    },
    {
      type: (prev) => (prev ? 'select' : null),
      name: 'yarnOrNPM',
      message: 'Use yarn or npm to install?',
      choices: [
        {
          value: 'yarn',
          title: 'Yarn',
        },
        {
          value: 'npm',
          title: 'NPM',
          description:
            'Juno uses yarn out of the box, usability of Juno with NPM is not guaranteed.',
        },
      ],
    },
  ];

  const answers = await prompt(questions, {
    onCancel: cleanup,
    onSubmit: cleanup,
  });
  return answers;
}

module.exports = { checkSetupVariables };
