import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row">
        
        {/* Left Side */}
        <span className="text-center sm:text-left">
          © {new Date().getFullYear()} HokieNest — Student Project for Educational Use
        </span>

        {/* Right Side Links */}
        <div className="flex items-center gap-4">
          <Link
            to="/terms"
            className="underline underline-offset-2 hover:text-slate-700"
          >
            Terms of Use &amp; Code of Conduct
          </Link>

          {/* Optional future link */}
          {/* <Link to="/privacy" className="underline underline-offset-2 hover:text-slate-700">
            Privacy Policy
          </Link> */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
