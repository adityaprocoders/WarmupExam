import bcrypt from "bcrypt";

const plainPassword = process.argv[2];
if (!plainPassword) {
    console.log("Usage: node scripts/generateOwnerHash.js yourPassword");
    process.exit(1);
}

bcrypt.hash(plainPassword, 10).then((hash) => {
    console.log("Add this to your .env:");
    console.log(`OWNER_PASSWORD_HASH=${hash}`);
});

// node scripts/generateOwnerHash.js "YourActualPassword" 