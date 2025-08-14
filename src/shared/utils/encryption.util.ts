import * as CryptoJS from 'crypto-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>('app.encryptionKey') || 'default-encryption-key';
  }

  encrypt(text: string): string {
    if (!text) return text;
    
    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  hash(text: string): string {
    return CryptoJS.SHA256(text).toString();
  }

  maskCardNumber(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 8) return cardNumber;
    
    const cleanNumber = cardNumber.replace(/\s+/g, '');
    const firstFour = cleanNumber.substring(0, 4);
    const lastFour = cleanNumber.substring(cleanNumber.length - 4);
    const middle = '*'.repeat(cleanNumber.length - 8);
    
    return `${firstFour}${middle}${lastFour}`;
  }

  generateToken(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }
}