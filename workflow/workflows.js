import { EXTENSION_NAME, settingsKey } from '../consts.js';
import { replaceInputWithPlaceholder } from './parser.js';

const t = SillyTavern.getContext().t;
const { getRequestHeaders, extensionSettings } = SillyTavern.getContext();

/**
 * Update the current workflow with a new placeholder
 * @param nodeId
 * @param inputName
 * @param placeholder
 */
export function updateCurrentWorkflow(nodeId, inputName, placeholder) {
    const workflowJson = currentWorkflowContent();
    const workflowElement = document.getElementById('sd_comfy_workflow_editor_workflow');
    const newWorkflow = replaceInputWithPlaceholder(workflowJson, nodeId, inputName, placeholder);
    if (!newWorkflow) {
        console.warn(`[${EXTENSION_NAME}]`, t`Failed to update workflow`);
        return;
    }
    if (newWorkflow === workflowJson) {
        console.warn(`[${EXTENSION_NAME}]`, t`Workflow not updated`);
        return;
    }
    workflowElement.value = newWorkflow;
    workflowElement.dispatchEvent(new Event('input'));
    console.log(`[${EXTENSION_NAME}]`, 'Workflow updated');
}

// some way to duplicate or save-as a workflow

/**
 * Save the current workflow as a new workflow
 * Will also re-fetch the workflows and update the workflow select element
 *
 * @param workflowJson
 * @param name
 * @returns {Promise<*>}
 */
export async function saveWorkflowAs(workflowJson, name) {
    const context = SillyTavern.getContext();

    if (!name) {
        console.warn(`[${EXTENSION_NAME}]`, t`No workflow name provided`);
        throw new Error(t`No workflow name provided`);
    }
    if (!String(name).toLowerCase().endsWith('.json')) {
        name += '.json';
    }

    const response = await fetch('/api/sd/comfy/save-workflow', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            file_name: name,
            workflow: workflowJson,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to save workflow: ${text}`);
        throw new Error(`Failed to save workflow.\n\n${text}`);
    }
    context.saveSettingsDebounced();
    await loadComfyWorkflows();
    return name;
}

/**
 * Get the current workflow name
 * @returns {string}
 */
export function currentWorkflowName() {
    const name = document.getElementById('sd_comfy_workflow_editor_name')?.textContent;
    if (!name) {
        console.warn(`[${EXTENSION_NAME}]`, t`No workflow name found`);
    }
    return name;
}

/**
 * Get the current workflow JSON
 * @returns {*}
 */
export function currentWorkflowContent() {
    const workflowJSON = document.getElementById('sd_comfy_workflow_editor_workflow')?.value;
    if (!workflowJSON) {
        console.warn(`[${EXTENSION_NAME}]`, t`No workflow JSON found`);
    }
    return workflowJSON;
}

/**
 * Get the available workflows
 *
 * @returns {Record<string, string>} Workflow name and ID
 */
export function availableWorkflows() {
    const workflowSelect = document.getElementById('sd_comfy_workflow');
    if (!workflowSelect) {
        console.warn(`[${EXTENSION_NAME}]`, t`No workflow select found`);
        return {};
    }
    return Array.from(workflowSelect.options).reduce((acc, option) => {
        acc[option.value] = option.textContent;
        return acc;
    }, {});
}

/**
 * Re-fetch ComfyUI workflows and update the select element
 * From stable-diffusion/index.js
 * What a mess
 *
 * @returns {Promise<void>}
 */
async function loadComfyWorkflows() {
    try {
        $('#sd_comfy_workflow').empty();
        const result = await fetch('/api/sd/comfy/workflows', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({}),
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        const workflows = await result.json();
        for (const workflow of workflows) {
            const option = document.createElement('option');
            option.innerText = workflow;
            option.value = workflow;
            option.selected = workflow === extensionSettings[settingsKey].sd.comfy_workflow;
            $('#sd_comfy_workflow').append(option);
        }
    } catch (error) {
        console.error(`Could not load ComfyUI workflows: ${error.message}`);
    }
}

export async function changeWorkflow(newWorkflowName) {
    const workflowSelect = document.getElementById('sd_comfy_workflow');
    if (!workflowSelect) {
        console.warn(`[${EXTENSION_NAME}]`, t`No workflow select found`);
        return;
    }
    if (workflowSelect.value === newWorkflowName) {
        console.log(`[${EXTENSION_NAME}]`, t`Workflow already selected`, newWorkflowName);
        return;
    }
    if (!Array.from(workflowSelect.options).some(option => option.value === newWorkflowName)) {
        console.warn(`[${EXTENSION_NAME}]`, t`Workflow not found`, newWorkflowName, workflowSelect.options);
        return;
    }

    const context = SillyTavern.getContext();
    context.extensionSettings.sd.comfy_workflow = newWorkflowName;
    workflowSelect.value = newWorkflowName;

    console.log(`[${EXTENSION_NAME}]`, t`Changed workflow to`, newWorkflowName);
    workflowSelect.dispatchEvent(new Event('change'));
}
