'use strict';

const STORAGE_KEY = 'ippm-membership-form-draft-v1';

const form = document.getElementById('membershipForm');
const academicRows = document.getElementById('academicRows');
const professionalRows = document.getElementById('professionalRows');
const academicTemplate = document.getElementById('academicRowTemplate');
const professionalTemplate = document.getElementById('professionalRowTemplate');
const photoInput = document.getElementById('passportPhoto');
const photoPreview = document.getElementById('photoPreview');
const removePhotoButton = document.getElementById('removePhoto');
const formMessage = document.getElementById('formMessage');
const organisationLogo = document.getElementById('organisationLogo');
const logoFallback = document.querySelector('.logo-fallback');

function showMessage(message, type = 'success') {
  formMessage.textContent = message;
  formMessage.className = `form-message visible ${type}`;
  formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearMessage() {
  formMessage.textContent = '';
  formMessage.className = 'form-message';
}

function addRow(container, template, values = {}) {
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector('tr');
  const inputs = row.querySelectorAll('input');

  if (template === academicTemplate) {
    inputs[0].value = values.institute || '';
    inputs[1].value = values.qualification || '';
    inputs[2].value = values.year || '';
  } else {
    inputs[0].value = values.institute || '';
    inputs[1].value = values.qualification || '';
    inputs[2].value = values.year || '';
  }

  row.querySelector('.remove-row').addEventListener('click', () => {
    if (container.children.length === 1) {
      inputs.forEach((input) => {
        input.value = '';
      });
      return;
    }
    row.remove();
  });

  container.appendChild(fragment);
}

function ensureInitialRows() {
  if (!academicRows.children.length) {
    for (let index = 0; index < 4; index += 1) {
      addRow(academicRows, academicTemplate);
    }
  }

  if (!professionalRows.children.length) {
    for (let index = 0; index < 3; index += 1) {
      addRow(professionalRows, professionalTemplate);
    }
  }
}

function collectRows(container) {
  return Array.from(container.querySelectorAll('tr'))
    .map((row) => {
      const inputs = row.querySelectorAll('input');
      return {
        institute: inputs[0].value.trim(),
        qualification: inputs[1].value.trim(),
        year: inputs[2].value.trim()
      };
    })
    .filter((row) => row.institute || row.qualification || row.year);
}

function collectFormData() {
  const data = {};
  const elements = form.querySelectorAll('input:not([type="file"]):not([name$="[]"]), select, textarea');

  elements.forEach((element) => {
    if (!element.name) return;
    data[element.name] = element.type === 'checkbox' ? element.checked : element.value;
  });

  data.academicQualifications = collectRows(academicRows);
  data.professionalQualifications = collectRows(professionalRows);
  data.attachments = {
    passportPhoto: photoInput.files[0]?.name || '',
    curriculumVitae: document.getElementById('cvFile').files[0]?.name || '',
    certificates: Array.from(document.getElementById('certificateFiles').files).map((file) => file.name)
  };
  data.generatedAt = new Date().toISOString();

  return data;
}

function saveDraft() {
  try {
    const data = collectFormData();
    delete data.attachments;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    showMessage('Draft saved in this browser. Uploaded files are not stored in the draft.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('The draft could not be saved in this browser.', 'error');
  }
}

function restoreDraft() {
  const rawDraft = localStorage.getItem(STORAGE_KEY);
  if (!rawDraft) return;

  try {
    const data = JSON.parse(rawDraft);

    Object.entries(data).forEach(([name, value]) => {
      if (name === 'academicQualifications' || name === 'professionalQualifications' || name === 'generatedAt') return;
      const element = form.elements.namedItem(name);
      if (!element) return;
      if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else {
        element.value = value ?? '';
      }
    });

    academicRows.innerHTML = '';
    professionalRows.innerHTML = '';

    const savedAcademic = data.academicQualifications || [];
    const savedProfessional = data.professionalQualifications || [];

    if (savedAcademic.length) {
      savedAcademic.forEach((row) => addRow(academicRows, academicTemplate, row));
    }

    if (savedProfessional.length) {
      savedProfessional.forEach((row) => addRow(professionalRows, professionalTemplate, row));
    }

    ensureInitialRows();
    showMessage('A previously saved draft has been restored.', 'success');
  } catch (error) {
    console.error(error);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function resetPhoto() {
  photoInput.value = '';
  photoPreview.innerHTML = '<span>Electronic copy acceptable</span>';
  removePhotoButton.hidden = true;
}

function handlePhotoSelection() {
  clearMessage();
  const file = photoInput.files[0];

  if (!file) {
    resetPhoto();
    return;
  }

  if (!file.type.startsWith('image/')) {
    resetPhoto();
    showMessage('Please select a valid image for the passport photograph.', 'error');
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    resetPhoto();
    showMessage('The passport photograph must be no larger than 2 MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const image = document.createElement('img');
    image.src = reader.result;
    image.alt = 'Applicant passport preview';
    photoPreview.replaceChildren(image);
    removePhotoButton.hidden = false;
  });
  reader.readAsDataURL(file);
}

function downloadApplication() {
  clearMessage();
  const data = collectFormData();
  const applicant = [data.surname, data.firstName].filter(Boolean).join('-').toLowerCase() || 'applicant';
  const safeName = applicant.replace(/[^a-z0-9-]+/g, '-');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `ippm-application-${safeName}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showMessage('Application data downloaded as a JSON file. Uploaded documents must be supplied separately.', 'success');
}

function clearForm() {
  const confirmed = window.confirm('Clear all entered information and remove the saved draft?');
  if (!confirmed) return;

  form.reset();
  localStorage.removeItem(STORAGE_KEY);
  academicRows.innerHTML = '';
  professionalRows.innerHTML = '';
  ensureInitialRows();
  resetPhoto();
  document.getElementById('applicationDate').valueAsDate = new Date();
  clearMessage();
}

function validateAndPrepare(event) {
  event.preventDefault();
  clearMessage();

  if (!form.checkValidity()) {
    form.reportValidity();
    showMessage('Please complete all required fields before validating the application.', 'error');
    return;
  }

  saveDraft();
  showMessage(
    'The application is complete and valid. Because GitHub Pages is a static host, this demo does not transmit the information to a server. Use Download application or Print to keep a copy.',
    'success'
  );
}

document.getElementById('addAcademicRow').addEventListener('click', () => addRow(academicRows, academicTemplate));
document.getElementById('addProfessionalRow').addEventListener('click', () => addRow(professionalRows, professionalTemplate));
document.getElementById('saveDraft').addEventListener('click', saveDraft);
document.getElementById('clearForm').addEventListener('click', clearForm);
document.getElementById('downloadApplication').addEventListener('click', downloadApplication);
document.getElementById('printForm').addEventListener('click', () => window.print());
removePhotoButton.addEventListener('click', resetPhoto);
photoInput.addEventListener('change', handlePhotoSelection);
form.addEventListener('submit', validateAndPrepare);

organisationLogo.addEventListener('error', () => {
  organisationLogo.style.display = 'none';
  logoFallback.style.display = 'grid';
});

ensureInitialRows();
restoreDraft();

if (!document.getElementById('applicationDate').value) {
  document.getElementById('applicationDate').valueAsDate = new Date();
}
