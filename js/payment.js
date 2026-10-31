/**
 * ImmoData - Fake Stripe Payment Controller (js/payment.js)
 * Implements:
 * - Dynamic order summary population from URL parameters
 * - Card number formatting with space grouping
 * - Expiry date formatting (MM / YY)
 * - Card brand detection (Visa, Mastercard, Amex, CB)
 * - Interactive validation
 * - 2-second realistic payment processing overlay & confirmation redirect
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Read URL Parameters & saved session
    const urlParams = new URLSearchParams(window.location.search);
    const savedData = JSON.parse(localStorage.getItem('immo_expert_data') || '{}');

    const plan = (urlParams.get('plan') || savedData.plan || 'standard').toLowerCase();
    const amount = parseInt(urlParams.get('amount') || savedData.amount || '99', 10);
    const address = urlParams.get('address') || savedData.address || localStorage.getItem('immo_last_query') || 'Bien sélectionné';
    const email = urlParams.get('email') || savedData.email || '';
    const delay = urlParams.get('delay') || savedData.delay || '3 jours';

    // Format plan label
    let planLabel = "Avis d'Expert Standard";
    let delayLabel = "3 jours ouvrés";
    if (plan.includes('urgent')) {
      planLabel = "Avis d'Expert Urgent Express";
      delayLabel = "Moins de 24h";
    } else if (plan.includes('eco')) {
      planLabel = "Avis d'Expert Économique";
      delayLabel = "7 jours";
    }

    // Populate order summary
    const summaryPlanName = document.getElementById('summaryPlanName');
    const summaryAmount = document.getElementById('summaryAmount');
    const orderItemTitle = document.getElementById('orderItemTitle');
    const orderItemPrice = document.getElementById('orderItemPrice');
    const orderTaxAmount = document.getElementById('orderTaxAmount');
    const orderItemProperty = document.getElementById('orderItemProperty');
    const payBtnLabel = document.getElementById('payBtnLabel');
    const cardEmailInput = document.getElementById('cardEmail');

    if (summaryPlanName) summaryPlanName.textContent = planLabel;
    if (summaryAmount) summaryAmount.textContent = `${amount},00`;
    if (orderItemTitle) orderItemTitle.textContent = `Rapport d'Expertise Certifié (${delayLabel})`;
    if (orderItemPrice) orderItemPrice.textContent = `${amount},00 €`;
    if (orderItemProperty) orderItemProperty.textContent = `Bien : ${address}`;
    if (payBtnLabel) payBtnLabel.textContent = `Payer ${amount},00 €`;

    // Compute French VAT (20% included)
    const tax = (amount * 0.20 / 1.20).toFixed(2).replace('.', ',');
    if (orderTaxAmount) orderTaxAmount.textContent = `${tax} €`;

    if (cardEmailInput && email) {
      cardEmailInput.value = email;
    }

    // 2. Input Fields Formatting & Masking
    const cardNumberInput = document.getElementById('cardNumber');
    const cardExpiryInput = document.getElementById('cardExpiry');
    const cardCvcInput = document.getElementById('cardCvc');
    const cardBrandIcon = document.getElementById('cardBrandIcon');

    // Card Number: format as "XXXX XXXX XXXX XXXX" & detect brand
    if (cardNumberInput) {
      cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // strip non-digits
        if (value.length > 16) value = value.substring(0, 16);

        // Detect brand
        detectCardBrand(value);

        // Add spaces every 4 digits
        const parts = [];
        for (let i = 0; i < value.length; i += 4) {
          parts.push(value.substring(i, i + 4));
        }
        e.target.value = parts.join(' ');
      });
    }

    function detectCardBrand(digits) {
      if (!cardBrandIcon) return;
      cardBrandIcon.className = 'card-brand-icon';

      if (digits.startsWith('4')) {
        cardBrandIcon.classList.add('visa');
        cardBrandIcon.innerHTML = '<strong>VISA</strong>';
      } else if (/^(5[1-5]|2[2-7])/.test(digits)) {
        cardBrandIcon.classList.add('mastercard');
        cardBrandIcon.innerHTML = '<strong>MC</strong>';
      } else if (/^(34|37)/.test(digits)) {
        cardBrandIcon.innerHTML = '<strong>AMEX</strong>';
      } else {
        cardBrandIcon.innerHTML = '<span>CB</span>';
      }
    }

    // Card Expiry: format as "MM / AA"
    if (cardExpiryInput) {
      cardExpiryInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 4) value = value.substring(0, 4);

        if (value.length >= 3) {
          e.target.value = `${value.substring(0, 2)} / ${value.substring(2)}`;
        } else {
          e.target.value = value;
        }
      });

      // Handle backspace over slash
      cardExpiryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value.length === 5) {
          e.target.value = e.target.value.substring(0, 2);
          e.preventDefault();
        }
      });
    }

    // Card CVC: digits only, max 4
    if (cardCvcInput) {
      cardCvcInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
      });
    }

    // 3. Form Submission & Fake Stripe Payment Flow
    const form = document.getElementById('stripePaymentForm');
    const processingOverlay = document.getElementById('processingOverlay');
    const paySubmitBtn = document.getElementById('paySubmitBtn');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const emailVal = document.getElementById('cardEmail').value.trim();
        const rawCard = cardNumberInput.value.replace(/\s+/g, '');
        const expiryVal = cardExpiryInput.value.trim();
        const cvcVal = cardCvcInput.value.trim();
        const nameVal = document.getElementById('cardName').value.trim();

        // Basic validation
        if (!emailVal || !emailVal.includes('@')) {
          alert('Veuillez saisir une adresse e-mail valide.');
          document.getElementById('cardEmail').focus();
          return;
        }

        if (rawCard.length < 15) {
          alert('Veuillez saisir un numéro de carte bancaire valide (16 chiffres).');
          cardNumberInput.focus();
          return;
        }

        if (expiryVal.length < 5) {
          alert('Veuillez saisir la date d\'expiration au format MM / AA.');
          cardExpiryInput.focus();
          return;
        }

        // Validate expiry month
        const expMonth = parseInt(expiryVal.substring(0, 2), 10);
        if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
          alert('Le mois d\'expiration de la carte est invalide.');
          cardExpiryInput.focus();
          return;
        }

        if (cvcVal.length < 3) {
          alert('Veuillez saisir un code de sécurité CVC à 3 ou 4 chiffres.');
          cardCvcInput.focus();
          return;
        }

        if (!nameVal) {
          alert('Veuillez renseigner le nom figurant sur la carte.');
          document.getElementById('cardName').focus();
          return;
        }

        // Disable button and show processing overlay
        paySubmitBtn.disabled = true;
        if (processingOverlay) {
          processingOverlay.classList.add('active');
        }

        // 2-second realistic delay before redirecting to confirmation
        setTimeout(() => {
          const confirmParams = new URLSearchParams({
            plan: plan,
            amount: amount,
            email: emailVal,
            address: address,
            name: nameVal
          });

          window.location.href = `confirmation.html?${confirmParams.toString()}`;
        }, 2000);
      });
    }
  });
})();
