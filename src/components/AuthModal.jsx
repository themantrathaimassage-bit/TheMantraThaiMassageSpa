import React, { useState, useEffect } from 'react';
import { FiX, FiPhone, FiUser, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { findOrCreateSquareCustomer, searchSquareCustomer } from '../data/squareCatalog';
import styles from './AuthModal.module.css';

const COUNTRY_CODES = [
    { code: '+61', flag: '🇦🇺', name: 'AU', fullLength: 10, placeholder: '04XX XXX XXX' },
];

const AuthModal = () => {
    const { isAuthModalOpen, closeAuth, login } = useAuth();
    const [step, setStep] = useState(1); // 1: Phone, 2: Name
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [countryCode, setCountryCode] = useState('+61');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isReturningUser, setIsReturningUser] = useState(false);

    const fullPhone = `${countryCode}${phone.replace(/^0/, '')}`;
    const country = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

    // 1. Reset state and lock scroll when modal opens
    useEffect(() => {
        if (isAuthModalOpen) {
            setStep(1);
            setError('');
            setIsLoading(false);
            setPhone('');
            setFirstName('');
            setLastName('');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isAuthModalOpen]);

    // Clear error when typing
    useEffect(() => {
        if (error) setError('');
    }, [phone]);

    // Validation logic for mobile numbers
    const validatePhone = (val) => {
        const s = val.replace(/\D/g, '');
        if (countryCode === '+61') {
            // AU: Starts with 04 (10 digits) or 4 (9 digits)
            return /^0?4\d{8}$/.test(s);
        }
        if (countryCode === '+66') {
            // TH: Starts with 06, 08, 09 (10 digits) or 6, 8, 9 (9 digits)
            return /^0?[689]\d{8}$/.test(s);
        }
        if (countryCode === '+65') {
            // SG: Starts with 8 or 9 (8 digits)
            return /^[89]\d{7}$/.test(s);
        }
        if (countryCode === '+1') {
            // US: 10 digits
            return /^\d{10}$/.test(s);
        }
        return s.length >= 8;
    };

    // Helper to check if a number is "typed enough" to trigger auto-search
    const isCompleteTyping = (val) => {
        const s = val.replace(/\D/g, '');
        if (countryCode === '+65') return s.length === 8;
        if (s.startsWith('0')) return s.length === country.fullLength;
        return s.length === country.fullLength - 1;
    };

    const manualSearchRef = React.useRef(false);

    // 2. Define the search logic as a reusable function
    const triggerPhoneSearch = async (manual = false) => {
        if (isLoading && !manual) return;
        if (manual) manualSearchRef.current = true;

        // Do not auto-trigger if it doesn't look like a valid complete number
        if (!manual && (!isCompleteTyping(phone) || !validatePhone(phone))) return;

        // Manual trigger validation
        if (manual && !validatePhone(phone)) {
            setError(`Please enter a valid ${country.name} mobile number`);
            manualSearchRef.current = false;
            return;
        }



        setError('');
        setIsLoading(true);

        try {


            const existingCustomer = await searchSquareCustomer(fullPhone);
            if (existingCustomer) {
                if (existingCustomer.given_name) {
                    login({
                        squareCustomerId: existingCustomer.id,
                        firstName: existingCustomer.given_name,
                        lastName: existingCustomer.family_name || '',
                        phone: fullPhone,
                    });
                    return;
                }

                if (manualSearchRef.current) {
                    setFirstName('');
                    setLastName('');
                    setIsReturningUser(false);
                    setStep(2);
                }
            } else {
                if (manualSearchRef.current) {
                    setIsReturningUser(false);
                    setStep(2);
                }
            }
        } catch (err) {
            console.error('Search error:', err);
            if (manualSearchRef.current) setStep(2);
        } finally {
            setIsLoading(false);
            manualSearchRef.current = false;
        }
    };

    // 3. Auto-search effect
    useEffect(() => {
        if (isAuthModalOpen && step === 1 && isCompleteTyping(phone)) {
            const timer = setTimeout(() => {
                triggerPhoneSearch(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [phone, step, isAuthModalOpen]);

    if (!isAuthModalOpen) return null;

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await triggerPhoneSearch(true);
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNameSubmit = async (e) => {
        e.preventDefault();
        if (!firstName) { setError('First name is required'); return; }
        setError('');
        setIsLoading(true);
        try {
            const customer = await findOrCreateSquareCustomer({
                phone: fullPhone,
                firstName,
                lastName,
            });
            login({
                squareCustomerId: customer.id,
                firstName: customer.given_name || firstName,
                lastName: customer.family_name || lastName,
                phone: fullPhone,
            });
        } catch (err) {
            console.error('Auth error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) closeAuth();
    };

    return (
        <div className={styles.overlay} onClick={handleBackdropClick}>
            <div className={styles.modal}>
                <button className={styles.closeBtn} onClick={closeAuth}>
                    <FiX />
                </button>

                <div className={styles.header}>
                    <div className={styles.iconWrapper}>
                        {step === 1 ? <FiPhone /> : <FiUser />}
                    </div>
                    <h2 className={styles.title}>
                        {step === 1 ? 'Welcome to The Mantra' : 'Complete your profile'}
                    </h2>
                    {step === 1 && (
                        <p className={styles.loginHint}>
                            Quick book. No passwords.
                        </p>
                    )}
                    <p className={styles.subtitle}>
                        {step === 1
                            ? 'Enter your mobile number to get started'
                            : 'Nearly there! Just a few more details'}
                    </p>
                </div>

                <div className={styles.content}>
                    {step === 1 ? (
                        <form onSubmit={handlePhoneSubmit} className={styles.form}>
                            <div className={styles.field}>
                                <label className={styles.label}>Mobile Number</label>
                                <div className={styles.phoneInputRow}>
                                    <select
                                        className={styles.countrySelect}
                                        value={countryCode}
                                        onChange={e => setCountryCode(e.target.value)}
                                        disabled
                                        style={{ backgroundColor: '#f9fafb', cursor: 'not-allowed', appearance: 'none' }}
                                    >
                                        {COUNTRY_CODES.map(c => (
                                            <option key={c.code} value={c.code}>
                                                {c.flag} {c.code}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="tel"
                                        className={styles.input}
                                        placeholder={country.placeholder}
                                        value={phone}
                                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                                        autoFocus
                                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                                    />
                                </div>
                            </div>

                            {error && <div className={styles.error}>{error}</div>}

                            <button
                                type="submit"
                                className={styles.primaryBtn}
                                disabled={isLoading}
                            >
                                {isLoading ? <span className={styles.loader} /> : <>Continue <FiArrowRight /></>}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleNameSubmit} className={styles.form}>
                            {isReturningUser && (
                                <div className={styles.returningBox}>
                                    ✨ Welcome back! We found your details.
                                </div>
                            )}
                            <div className={styles.nameGrid}>
                                <div className={styles.field}>
                                    <label className={styles.label}>First Name</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="First name"
                                        value={firstName}
                                        onChange={e => setFirstName(e.target.value)}
                                        autoFocus={!firstName}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Last Name</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        placeholder="Last name"
                                        value={lastName}
                                        onChange={e => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>

                            {error && <div className={styles.error}>{error}</div>}

                            <button
                                type="submit"
                                className={styles.primaryBtn}
                                disabled={isLoading}
                            >
                                {isLoading ? <span className={styles.loader} /> : 'Join & Continue'}
                            </button>

                            <button type="button" className={styles.backBtn} onClick={() => {
                                setStep(1);
                                setIsLoading(false);
                                setError('');
                            }}>
                                <FiArrowLeft /> Use different number
                            </button>
                        </form>
                    )}
                </div>

                <div className={styles.footer}>
                    By continuing, you agree to our Terms of Service.
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
