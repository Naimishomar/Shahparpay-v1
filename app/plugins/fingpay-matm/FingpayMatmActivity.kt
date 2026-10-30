package com.shahparpay.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import com.fingpay.microatmsdk.MicroAtmLoginScreen
import com.fingpay.microatmsdk.utils.Constants

/**
 * Bridge between JS and Fingpay's Micro ATM SDK. expo-intent-launcher can only
 * send string/number extras (numbers arrive as doubles), while the SDK reads
 * TYPE and MICROATM_MANUFACTURER as ints and LATITUDE/LONGITUDE as doubles;
 * this activity retypes them, runs the SDK, and hands its result back as
 * plain values JS can read.
 */
class FingpayMatmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (savedInstanceState != null) return
    val extras = intent.extras ?: Bundle()
    fun text(key: String) = extras.get(key)?.toString().orEmpty()
    fun number(key: String) = text(key).toDoubleOrNull() ?: 0.0

    val sdk = Intent(this, MicroAtmLoginScreen::class.java).apply {
      putExtra(Constants.MERCHANT_USERID, text("MERCHANT_USERID"))
      putExtra(Constants.MERCHANT_PASSWORD, text("MERCHANT_PASSWORD"))
      putExtra(Constants.SUPER_MERCHANTID, text("SUPER_MERCHANTID"))
      putExtra(Constants.MOBILE_NUMBER, text("MOBILE_NUMBER"))
      putExtra(Constants.AMOUNT, text("AMOUNT"))
      putExtra(Constants.AMOUNT_EDITABLE, false)
      putExtra(Constants.REMARKS, text("REMARKS"))
      putExtra(Constants.TXN_ID, text("TXN_ID"))
      putExtra(
        Constants.IMEI,
        Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID).orEmpty()
      )
      putExtra(Constants.LATITUDE, number("LATITUDE"))
      putExtra(Constants.LONGITUDE, number("LONGITUDE"))
      putExtra(Constants.TYPE, number("TYPE").toInt())
      putExtra(Constants.MICROATM_MANUFACTURER, Constants.MoreFun)
    }
    startActivityForResult(sdk, REQUEST)
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    // Strings and booleans only: the mini statement LIST is custom Parcelables JS cannot read.
    val out = Intent()
    data?.extras?.let { result ->
      for (key in result.keySet()) {
        when (val value = result.get(key)) {
          null -> {}
          is Boolean -> out.putExtra(key, value)
          is String, is Number, is Char -> out.putExtra(key, value.toString())
          else -> {}
        }
      }
    }
    setResult(resultCode, out)
    finish()
  }

  private companion object {
    const val REQUEST = 7301
  }
}
