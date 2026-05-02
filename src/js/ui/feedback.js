import { $, create, toast } from '../utils.js';
import { api } from '../api.js';

/**
 * Feedback UI Module
 * Handles the manual user feedback collection via the "Dê seu Feedback" button.
 */

export function setupFeedback() {
  const btn = $('btn-feedback');
  if (!btn) return;

  btn.addEventListener('click', () => {
    openFeedbackModal();
  });
}

function openFeedbackModal() {
  currentSatisfaction = 0; // Reset
  const overlay = create('div', { className: 'dialog-overlay' });
  
  const box = create('div', { className: 'dialog-box' }, [
    create('div', { className: 'dialog-message', text: 'Como está sua experiência com o EAV?' }),
    
    create('div', { className: 'satisfaction-picker', style: 'display: flex; justify-content: space-around; font-size: 32px; margin-bottom: 20px;' }, [
      create('button', { 
        className: 'ui-interactive emoji-btn', 
        text: '😞', 
        style: 'background:none; border:none; cursor:pointer; transition: transform 0.2s; padding: 10px; border-radius: 50%;',
        onClick: (e) => selectSatisfaction(1, e.currentTarget) 
      }),
      create('button', { 
        className: 'ui-interactive emoji-btn', 
        text: '😐', 
        style: 'background:none; border:none; cursor:pointer; transition: transform 0.2s; padding: 10px; border-radius: 50%;',
        onClick: (e) => selectSatisfaction(2, e.currentTarget) 
      }),
      create('button', { 
        className: 'ui-interactive emoji-btn', 
        text: '🙂', 
        style: 'background:none; border:none; cursor:pointer; transition: transform 0.2s; padding: 10px; border-radius: 50%;',
        onClick: (e) => selectSatisfaction(3, e.currentTarget) 
      })
    ]),
    
    create('textarea', { 
      id: 'feedback-comment', 
      className: 'dialog-input', 
      placeholder: 'Conte-nos mais (opcional)...',
      style: 'height: 80px; resize: none; font-family: inherit;'
    }),
    
    create('div', { className: 'dialog-actions' }, [
      create('button', { className: 'dialog-btn cancel', text: 'Cancelar', onClick: () => overlay.remove() }),
      create('button', { 
        className: 'dialog-btn confirm', 
        text: 'Enviar Feedback', 
        onClick: () => submitFeedback(overlay) 
      })
    ])
  ]);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

let currentSatisfaction = 0;

function selectSatisfaction(val, element) {
  currentSatisfaction = val;
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.style.background = 'transparent';
    b.style.transform = 'scale(1)';
  });
  element.style.background = 'rgba(59,130,246,0.2)';
  element.style.transform = 'scale(1.2)';
}

async function submitFeedback(overlay) {
  if (currentSatisfaction === 0) {
    toast('Por favor, selecione um nível de satisfação.', 'warn');
    return;
  }

  const comment = $('feedback-comment')?.value || '';
  
  try {
    const res = await api.submitFeedback({
      satisfaction: currentSatisfaction,
      comment,
      deviceInfo: {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        windowSize: `${window.innerWidth}x${window.innerHeight}`
      }
    });

    if (res.ok) {
      toast('Obrigado! Feedback enviado com sucesso.', 'success');
      overlay.remove();
    } else {
      toast('Falha ao enviar feedback: ' + (res.error || 'Erro desconhecido'), 'error');
    }
  } catch (e) {
    console.error('[UI-FEEDBACK] Submit error:', e);
    toast('Erro de conexão ao enviar feedback.', 'error');
  }
}
