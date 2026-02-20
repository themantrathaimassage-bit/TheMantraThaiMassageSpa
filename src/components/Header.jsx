import React, { useState } from 'react';
import { FiSearch, FiMenu, FiX, FiUser, FiLogOut } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import styles from './Header.module.css';
import { useSearch } from '../context/SearchContext';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    const { searchQuery, setSearchQuery } = useSearch();
    const { user, openAuth, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
        if (isMobileSearchOpen) setIsMobileSearchOpen(false);
    };

    const toggleMobileSearch = () => {
        setIsMobileSearchOpen(!isMobileSearchOpen);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <div className={styles.left}>
                    <Link to="/" className={styles.logoLink}>
                        <img src="/images/logo.png" alt="The Mantra Thai Spa" className={styles.logoImage} />
                    </Link>
                </div>

                {/* Desktop Search */}
                <div className={`${styles.center} ${styles.desktopSearch}`}>
                    <div className={styles.searchBar}>
                        <FiSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search services, reviews, or details..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className={styles.right}>
                    {/* Desktop Nav */}
                    <nav className={`${styles.nav} ${styles.desktopNav}`}>
                        <a href="#pricing" className={styles.navLink}>Pricing</a>
                        <a href="#location" className={styles.navLink}>Location</a>
                        <Link to="/booking" className={styles.navLink}>Book now</Link>

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
                            <>
                                <button onClick={() => openAuth()} className={styles.loginBtnLink}>Login</button>
                                <button onClick={() => openAuth()} className={styles.signUpBtn}>Sign Up</button>
                            </>
                        )}
                    </nav>

                    {/* Mobile Controls */}
                    <div className={styles.mobileControls}>
                        <button className={styles.iconBtn} onClick={toggleMobileSearch}>
                            {isMobileSearchOpen ? <FiX /> : <FiSearch />}
                        </button>
                        <button className={styles.iconBtn} onClick={toggleMobileMenu}>
                            {isMobileMenuOpen ? <FiX /> : <FiMenu />}
                        </button>
                        <Link to="/booking" className={styles.mobileBookBtn}>Book now</Link>
                    </div>
                </div>
            </div>

            {/* Mobile Search Bar Overlay */}
            {isMobileSearchOpen && (
                <div className={styles.mobileSearchContainer}>
                    <div className={styles.searchBar}>
                        <FiSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
            )}

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className={styles.mobileMenuDropdown}>
                    <a href="#pricing" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
                    <a href="#location" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>Location</a>
                    <Link to="/booking" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>Book now</Link>

                    {user ? (
                        <>
                            <div className={styles.mobileUser}>
                                <div className={styles.avatar}>
                                    <FiUser />
                                </div>
                                <span>{user.firstName}</span>
                            </div>
                            <button onClick={logout} className={styles.mobileNavLink}>Logout</button>
                        </>
                    ) : (
                        <div className={styles.mobileAuthButtons}>
                            <button onClick={() => { openAuth(); setIsMobileMenuOpen(false); }} className={styles.mobileUserLoginBtn}>Login</button>
                            <button onClick={() => { openAuth(); setIsMobileMenuOpen(false); }} className={styles.mobileUserSignUpBtn}>Sign Up</button>
                        </div>
                    )}
                </div>
            )}
        </header>
    );
};

export default Header;
