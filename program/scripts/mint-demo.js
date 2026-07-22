#!/usr/bin/env node
/**
 * Mint a demo token through token_minter. Run from program/: node scripts/mint-demo.js
 * Requires: validator running, programs deployed, oracle + minter initialized.
 */
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import BN from "bn.js";

const require = createRequire(import.meta.url);

const ORACLE_PROGRAM_ID = new PublicKey("BZzWDRREZ3Bw4E7oJrQKVRJgkPd2hkmYLXHjpsmnUhXC");
const MINTER_PROGRAM_ID = new PublicKey("7wzZRUV2jvg5fyecgdaDVXBa3eYP7yJ2KTqBCLjxPKTa");
const ORACLE_SEED = Buffer.from("oracle_state");
const MINTER_SEED = Buffer.from("minter_config");

const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME || "", ".config/solana/id.json");

async function main() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8899";
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );

  const minterIdl = require(path.join(process.cwd(), "target/idl/token_minter.json"));
  const minterCoder = new BorshInstructionCoder(minterIdl);

  const [oraclePda] = PublicKey.findProgramAddressSync([ORACLE_SEED], ORACLE_PROGRAM_ID);
  const [minterPda] = PublicKey.findProgramAddressSync([MINTER_SEED], MINTER_PROGRAM_ID);

  const mintKeypair = Keypair.generate();
  const userAta = getAssociatedTokenAddressSync(mintKeypair.publicKey, payer.publicKey);

  const ix = new TransactionInstruction({
    programId: MINTER_PROGRAM_ID,
    keys: [
      { pubkey: minterPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: payer.publicKey, isSigner: false, isWritable: true }, // treasury = wallet from init
      { pubkey: ORACLE_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: oraclePda, isSigner: false, isWritable: false },
      { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: minterCoder.encode("mint_token", {
      decimals: 6,
      initial_supply: new BN(1_000_000_000),
      name: "",
      symbol: "",
      uri: "",
    }),
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair], {
    commitment: "confirmed",
  });
  console.log("mint:", mintKeypair.publicKey.toBase58());
  console.log("tx:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
