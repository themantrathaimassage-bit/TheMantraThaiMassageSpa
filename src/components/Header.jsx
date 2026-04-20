import React, { useState } from 'react';
import { FiMenu, FiX, FiUser, FiPhone } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import { useUser } from '../context/UserContext';

const Header = () => {
    const { user, clearUser } = useUser();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.left}>
                    <div className={styles.logoWrapper}>
                        <img src="/images/logo.png" alt="The Mantra Thai Spa" className={styles.logoImage} />
                    </div>
                </div>

                <div className={styles.right}>
                    <div className={styles.desktopActions}>
                        <a href="/#services" className={styles.navLink}>Pricing</a>
                        <a href="/#location" className={styles.navLink}>Location</a>
                        <a href="/#reviews" className={styles.navLink}>What our clients say</a>
                        <a href="tel:0493853415" className={styles.callBtn}>
                            <FiPhone className={styles.btnIcon} />
                            <span>Call 0493 853 415</span>
                        </a>
                        <Link to="/booking" className={styles.bookBtn}>Book Online</Link>
                        {user && (
                            <>
                                <div className={styles.divider}></div>
                                <div className={styles.userProfile}>
                                    <div className={styles.avatar}><FiUser /></div>
                                    <span className={styles.userName}>{user.firstName || 'Customer'}</span>
                                    <button onClick={clearUser} className={styles.logoutTextBtn} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '4px', textDecoration: 'underline', color: '#64748b' }}>
                                        (Not you?)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <div className={styles.mobileControls}>
                        <a href="tel:0493853415" className={styles.mobileCallIconBtn}><FiPhone /></a>
                        <Link to="/booking" className={styles.mobileBookBtnAction}>Book Now</Link>
                        <button className={styles.menuBtn} onClick={toggleMobileMenu}>
                            {isMobileMenuOpen ? <FiX /> : <FiMenu />}
                        </button>
                    </div>
                </div>
            </div>
            {isMobileMenuOpen && (
                <div className={styles.mobileMenuDropdown}>
                    {user && (
                        <div className={styles.mobileMenuHeader}>
                            <div className={styles.mobileUser}>
                                <div className={styles.avatar}><FiUser /></div>
                                <span>Hello, {user.firstName || 'Customer'}</span>
                            </div>
                        </div>
                    )}
                    <a href="/#services" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
                    <a href="/#location" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>Location</a>
                    <a href="/#reviews" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>What our clients say</a>
                    <a href="tel:0493853415" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}><FiPhone style={{ marginRight: '8px' }} /> Call 0493853415</a>
                    {user && <button onClick={() => { clearUser(); setIsMobileMenuOpen(false); }} className={styles.mobileNavLink} style={{ color: '#e11d48' }}>Reset Profile (Not you?)</button>}
                </div>
            )}
        </header>
    );
};

export default Header;
