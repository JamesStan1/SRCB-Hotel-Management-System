"use client";

export default function Loading({ message = "Loading...", fullScreen = false, overlay = false, size = "md" }) {
  const Container = ({ children }) => {
    if (overlay) {
      return (
        <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50">
          {children}
        </div>
      );
    }
    if (fullScreen) {
      return (
        <div className="flex justify-center items-center h-screen bg-white">
          {children}
        </div>
      );
    }
    return (
      <div className="flex justify-center items-center p-6 bg-white">
        {children}
      </div>
    );
  };

  return (
    <Container>
      <div className="text-center animate-pulse">
        <div className="mb-4">
          <img
            src="/Joannaslogo.png"
            alt="Joanna's Hotel Logo"
            className={`mx-auto rounded-md ${size === 'xl' ? 'w-48 h-28 sm:w-80 sm:h-40 md:w-74 md:h-48' : size === 'lg' ? 'w-48 h-20 sm:w-36 sm:h-28 md:w-54 md:h-32' : 'w-30 h-18 sm:w-25 sm:h-14 md:w-38 md:h-20'}`}
          />
        </div>
        <p className={`${size === 'xl' ? 'text-lg sm:text-xl md:text-2xl' : size === 'lg' ? 'text-sm sm:text-base md:text-lg' : 'text-xs sm:text-sm md:text-base'} font-medium text-gray-600`}>
          {message}
        </p>
      </div>
    </Container>
  );
}


