import { useThemeContext } from "@/contexts/ThemeContext";
import bgLight from "@/assets/bg-light.jpg";
import bgDark from "@/assets/bg-dark.jpg";

const AppBackground = () => {
  const { theme } = useThemeContext();
  return (
    <div
      className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-500"
      style={{ backgroundImage: `url(${theme === "dark" ? bgDark : bgLight})` }}
    />
  );
};

export default AppBackground;
