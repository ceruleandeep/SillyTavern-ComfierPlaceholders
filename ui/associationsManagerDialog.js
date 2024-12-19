import { EXTENSION_NAME, settingsKey } from '../consts.js';
import { availableWorkflows, currentWorkflowContent } from '../workflow/workflows.js';
import { iconButton, ButtonType } from './iconButton.js';

const t = SillyTavern.getContext().t;

function createAssociationRow(srcWorkflow, dstWorkflow) {
    const row = document.createElement('div');
    row.classList.add('association-row');
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.style.alignItems = 'center';
    row.style.marginBottom = '10px';

    const srcLabel = document.createElement('div');
    srcLabel.textContent = srcWorkflow;
    srcLabel.style.flex = '1';

    const arrow = document.createElement('i');
    arrow.classList.add('fas', 'fa-arrow-right');
    
    const dstLabel = document.createElement('div');
    dstLabel.textContent = dstWorkflow;
    dstLabel.style.flex = '1';

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '5px';

    const exportButton = iconButton('Export', 'download', {
        title: 'Export both workflows as zip',
        srOnly: true,
    });
    exportButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/sd/comfy/export-workflows', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    workflows: [srcWorkflow, dstWorkflow]
                })
            });
            if (!response.ok) throw new Error(await response.text());
            
            // Trigger download of the zip file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${srcWorkflow}_and_${dstWorkflow}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export workflows:', error);
            toastr.error(error.message, 'Export failed');
        }
    });

    const removeButton = iconButton('Remove', 'trash', {
        buttonType: ButtonType.DANGER,
        title: 'Remove association',
        srOnly: true,
    });
    removeButton.addEventListener('click', async () => {
        // Validate workflows still exist
        const workflows = await availableWorkflows();
        if (!workflows[srcWorkflow] && !workflows[dstWorkflow]) {
            const context = SillyTavern.getContext();
            const settings = context.extensionSettings[settingsKey];
            delete settings.savedAs[srcWorkflow];
            context.saveSettingsDebounced();
            row.remove();
            return;
        }

        if (!workflows[srcWorkflow]) {
            toastr.warning(`Source workflow "${srcWorkflow}" no longer exists`, 'Invalid association');
        }
        if (!workflows[dstWorkflow]) {
            toastr.warning(`Destination workflow "${dstWorkflow}" no longer exists`, 'Invalid association');
        }

        if (await context.callPopup('This association references workflows that still exist. Remove anyway?', 'confirm')) {
            delete settings.savedAs[srcWorkflow];
            context.saveSettingsDebounced();
            row.remove();
        }
    });

    buttonsContainer.append(exportButton, removeButton);
    row.append(srcLabel, arrow, dstLabel, buttonsContainer);
    return row;
}

async function showAssociationsManagerDialog() {
    const context = SillyTavern.getContext();
    const settings = context.extensionSettings[settingsKey];
    
    const dialog = document.createElement('div');
    dialog.classList.add('associations-dialog');

    const header = document.createElement('div');
    header.style.marginBottom = '1em';
    const h3 = document.createElement('h3');
    h3.textContent = t`Workflow Associations`;
    header.appendChild(h3);
    dialog.appendChild(header);

    const description = document.createElement('p');
    description.textContent = t`Manage associations between original workflows and their saved versions.`;
    description.style.marginBottom = '1em';
    dialog.appendChild(description);

    const associationsList = document.createElement('div');
    associationsList.classList.add('associations-list');
    
    // Add existing associations
    for (const [srcWorkflow, savedAs] of Object.entries(settings.savedAs)) {
        const row = createAssociationRow(srcWorkflow, savedAs.dstWorkflowName);
        associationsList.appendChild(row);
    }
    
    dialog.appendChild(associationsList);

    // Show empty state if no associations
    if (associationsList.children.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.classList.add('empty-state');
        emptyState.style.textAlign = 'center';
        emptyState.style.color = 'var(--SmartThemeEmColor)';
        emptyState.textContent = t`No workflow associations found`;
        associationsList.appendChild(emptyState);
    }

    await context.callGenericPopup(dialog, context.POPUP_TYPE.ALERT, t`Workflow Associations`);
}

export { showAssociationsManagerDialog };
