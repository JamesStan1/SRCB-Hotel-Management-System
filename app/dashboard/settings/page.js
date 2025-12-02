"use client";

import General from "./general/page";
import Export from "./export/page";
import AccessGuard from "../../components/AccessGuard";
import { Permissions } from "../../lib/rbac";

export default function Settings({ activeSubPage }) {
  const renderSubPage = () => {
    switch (activeSubPage) {
      case "general":
        return <General />;
      case "export":
        return <Export />;
      case "settings":
      default:
        return <General />;
    }
  };

  return (
    <AccessGuard moduleKey={Permissions.Settings} action="manage" fallback={<div className="p-6 text-red-600">You do not have access to Settings.</div>}>
      <div className="p-6">
        {renderSubPage()}
      </div>
    </AccessGuard>
  );
}
