import React, { useState } from 'react';
import { FiMenu, FiX, FiUser, FiLogOut, FiPhone } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    const { user, openAuth, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.left}>
                    <Link to="/" className={styles.logoLink}>
                        <img src="/images/logo.png" alt="The Mantra Thai Spa" className={styles.logoImage} />
                    </Link>
                </div>

                <div className={styles.right}>
                    {/* Desktop Actions */}
                    <div className={styles.desktopActions}>
                        <a href="#pricing" className={styles.navLink}>Pricing</a>
                        <a href="#location" className={styles.navLink}>Location</a>
                        <a href="#reviews" className={styles.navLink}>What our clients say</a>

                        <a href="tel:0493853415" className={styles.callBtn}>
                            <FiPhone className={styles.btnIcon} />
                            <span>Call 0493 853 415</span>
                        </a>
                        <Link to="/booking" className={styles.bookBtn}>Book Online</Link>

                        <div className={styles.divider}></div>

                        {user ? (
                            <div className={styles.userProfile}>
                                <div className={styles.avatar}>
                                    <FiUser />
                                </div>
                                <span className={styles.userName}>{user.firstName}</span>
                                <button onClick={logout} className={styles.logoutBtn} title="Logout">
                                    <FiLogOut />
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => openAuth()} className={styles.loginBtn}>Login / Sign Up</button>
                        )}
                    </div>

                    {/* Mobile Controls */}
                    <div className={styles.mobileControls}>
                        <a href="tel:0493853415" className={styles.mobileCallIconBtn}>
                            <FiPhone />
                        </a>
                        <Link to="/booking" className={styles.mobileBookBtnAction}>Book Now</Link>
                        <button className={styles.menuBtn} onClick={toggleMobileMenu}>
                            {isMobileMenuOpen ? <FiX /> : <FiMenu />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className={styles.mobileMenuDropdown}>
                    <div className={styles.mobileMenuHeader}>
                        {user ? (
                            <div className={styles.mobileUser}>
                                <div className={styles.avatar}>
                                    <FiUser />
                                </div>
                                <span>{user.firstName}</span>
                            </div>
                        ) : (
                            <button onClick={() => { openAuth(); setIsMobileMenuOpen(false); }} className={styles.mobileLoginLargeBtn}>Login / Sign Up</button>
                        )}
                    </div>

                    <a href="#pricing" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
                    <a href="#location" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>Location</a>
                    <a href="#reviews" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>What our clients say</a>
                    <a href="tel:0493853415" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
                        <FiPhone style={{ marginRight: '8px' }} /> Call us 0493853415
                    </a>

                    {user && (
                        <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className={styles.mobileNavLink}>Logout</button>
                    )}
                </div>
            )}
        </header>
    );
};

export default Header;
