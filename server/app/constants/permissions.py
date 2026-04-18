PERMISSION_GROUPS = [
    {
        "group": "Users",
        "items": [
            {"code": "users:manage", "label": "Manage Users"},
            {"code": "users:view", "label": "View Users"},
        ],
    },
    {
        "group": "Roles",
        "items": [
            {"code": "roles:view", "label": "View Roles"},
            {"code": "roles:assign", "label": "Assign Roles"},
            {"code": "roles:manage", "label": "Manage Roles"},
        ],
    },
    {
        "group": "Matters",
        "items": [
            {"code": "matters:view", "label": "View Matters"},
            {"code": "matters:create", "label": "Create Matters"},
            {"code": "matters:edit", "label": "Edit Matters"},
            {"code": "matters:delete", "label": "Delete Matters"},
        ],
    },
    {
        "group": "Cause List",
        "items": [
            {"code": "causelist:view", "label": "View Cause List"},
            {"code": "causelist:generate", "label": "Generate Cause List"},
        ],
    },
    {
        "group": "MIS",
        "items": [
            {"code": "mis:view", "label": "View MIS"},
            {"code": "mis:export", "label": "Export MIS"},
        ],
    },
    {
        "group": "Counsels",
        "items": [
            {"code": "counsels:view", "label": "View Counsels"},
            {"code": "counsels:create", "label": "Create Counsels"},
            {"code": "counsels:approve", "label": "Approve Counsels"},
        ],
    },
    {
        "group": "Clients",
        "items": [
            {"code": "clients:view", "label": "View Clients"},
            {"code": "clients:create", "label": "Create Clients"},
            {"code": "clients:edit", "label": "Edit Clients"},
        ],
    },
    {
        "group": "Invoices",
        "items": [
            {"code": "invoices:view", "label": "View Invoices"},
            {"code": "invoices:create", "label": "Create Invoices"},
            {"code": "invoices:approve", "label": "Approve Invoices"},
        ],
    },
    {
        "group": "Accounts",
        "items": [
            {"code": "accounts:view", "label": "View Accounts"},
            {"code": "accounts:manage", "label": "Manage Accounts"},
        ],
    },
    {
        "group": "Alerts",
        "items": [
            {"code": "alerts:view", "label": "View Alerts"},
            {"code": "alerts:create", "label": "Create Alerts"},
        ],
    },
]


def all_permission_codes():
    return [
        item["code"]
        for group in PERMISSION_GROUPS
        for item in group["items"]
    ]