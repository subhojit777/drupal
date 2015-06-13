<?php

/**
 * @file
 * Contains \Drupal\user\Form\UserPasswordForm.
 */

namespace Drupal\user\Form;

use Drupal\Core\Field\Plugin\Field\FieldType\EmailItem;
use Drupal\Core\Form\FormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Render\Element\Email;
use Drupal\user\UserStorageInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Drupal\Component\Utility\Crypt;
use Drupal\Core\Site\Settings;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Url;

/**
 * Provides a user password reset form.
 */
class UserPasswordForm extends FormBase {

  /**
   * The user storage.
   *
   * @var \Drupal\user\UserStorageInterface
   */
  protected $userStorage;

  /**
   * The language manager.
   *
   * @var \Drupal\Core\Language\LanguageManagerInterface
   */
  protected $languageManager;

  /**
   * Constructs a UserPasswordForm object.
   *
   * @param \Drupal\user\UserStorageInterface $user_storage
   *   The user storage.
   * @param \Drupal\Core\Language\LanguageManagerInterface $language_manager
   *   The language manager.
   */
  public function __construct(UserStorageInterface $user_storage, LanguageManagerInterface $language_manager) {
    $this->userStorage = $user_storage;
    $this->languageManager = $language_manager;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('entity.manager')->getStorage('user'),
      $container->get('language_manager')
    );
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId() {
    return 'user_pass';
  }

  /**
   * {@inheritdoc}
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request object.
   */
  public function buildForm(array $form, FormStateInterface $form_state) {

    // When a user requests a password reset we check for username and email
    // conflicts using a multistep form.
    if (empty($form_state->getValue('step'))) {
      $form['step'] = array(
        '#type' => 'hidden',
        '#value' => 1,
      );
      $form_state->setValue('step', 1);
    }

    if ($form_state->getValue('step') == 1) {
      $form['name'] = array(
        '#type' => 'textfield',
        '#title' => t('Username or e-mail address'),
        '#size' => 60,
        '#maxlength' => max(USERNAME_MAX_LENGTH, Email::EMAIL_MAX_LENGTH),
        '#required' => TRUE,
        '#attributes' => array(
          'autocorrect' => 'off',
          'autocapitalize' => 'off',
          'spellcheck' => 'false',
          'autofocus' => 'autofocus',
        ),
      );
      // Allow logged in users to request this also.
      $user = $this->currentUser();
      if ($user->id() > 0) {
        $form['name']['#type'] = 'value';
        $form['name']['#value'] = $user->getEmail();
        $form['mail'] = array(
          '#prefix' => '<p>',
          '#markup' =>  t('Password reset instructions will be mailed to %email. You must log out to use the password reset link in the e-mail.', array('%email' => $user->getEmail())),
          '#suffix' => '</p>',
        );
      }
    }
    else {
      // Where there is a conflict between the username and email address for two
      // users we supply both accounts as an option for the password reset.
      $accounts = $form_state->getStorage()['accounts'];
      $options = array();
      foreach ($accounts as $account) {
        $label = t('The account with the username: @name', array('@name' => $account->getUsername()));
        if ($account->getEmail() == $form_state->getStorage()['name']) {
          $label = t('The account with the email address: @email', array('@email' => $account->getEmail()));
        }
        $options[Crypt::hashBase64(Settings::getHashSalt() . $account->id())] = $label;
      }
      $form['choose_account'] = array(
        '#type' => 'radios',
        '#title' => t('Choose account'),
        '#required' => TRUE,
        '#prefix' => "<p>" . t("There is a username conflict with the email address @email. Please select which account password to reset.", array('@email' => $form_state->getStorage()['name'])) . "</p>",
        '#options' => $options,
        '#default_value' => Crypt::hashBase64(Settings::getHashSalt() . reset($accounts)->id()),
      );
    }
    $form['actions'] = array('#type' => 'actions');
    if ($form_state->getValue('step') == 2) {
      $form['actions']['cancel'] = array(
        '#type' => 'submit',
        '#value' => t('Cancel'),
        '#name' => 'cancel',
        '#limit_validation_errors' => array(),
        '#weight' => 5,
      );
    }
    $form['actions']['submit'] = array(
      '#type' => 'submit',
      '#value' => t('E-mail new password'),
      '#name' => 'submit'
    );

    return $form;
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state) {
    if ($form_state->getValue('step') == 1) {
      $name = trim($form_state->getValue('name'));
      $accounts = array();
      // Try to load by email.
      $users = entity_load_multiple_by_properties('user', array('mail' => $name, 'status' => '1'));
      $account_by_email = reset($users);
      if ($account_by_email) {
        $accounts[Crypt::hashBase64(Settings::getHashSalt() . $account_by_email->id())] = $account_by_email;
      }
      // Also try to load by user name, but only when the user is not logged in.
      $user = $this->currentUser();
      if ($user->id() == 0) {
        $users = entity_load_multiple_by_properties('user', array('name' => $name, 'status' => '1'));
        $account_by_name = reset($users);
        if ($account_by_name) {
          $accounts[Crypt::hashBase64(Settings::getHashSalt() . $account_by_name->id())] = $account_by_name;
        }
      }
      if (!empty($accounts)) {
        $form_state->setValue('accounts', $accounts);
      }
      else {
        $form_state->setErrorByName('name', t('Sorry, %name is not recognized as a username or an e-mail address.', array('%name' => $name)));
      }
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state) {
    $language_interface = \Drupal::languageManager()->getCurrentLanguage(LanguageInterface::TYPE_INTERFACE);

    if ($form_state->getValue('step') == 1) {
      $accounts = $form_state->getValue('accounts');
      if (count($accounts) > 1) {
        $form_state->setValue('step', 2);
        $form_state->setStorage(array(
          'name' => $form_state->getValue('name'),
          'accounts' => $accounts,
        ));
        $form_state->setRebuild();
      }
      else {
        $account = reset($accounts);
      }
    }
    else {
      if ($form_state->getTriggeringElement() == 'submit') {
        $chosen_account = $form_state->getValue('choose_account');
        $account = $form_state->getStorage(['accounts', $chosen_account]);
      }
      else {
        $form_state->setRedirectUrl(Url::fromRoute('user.pass'));
      }
    }
    if (isset($account)) {
      // Mail one-time login URL and instructions using current language.
      $mail = _user_mail_notify('password_reset', $account->getBCEntity(), $language_interface->id);
      if (!empty($mail)) {
        watchdog('user', 'Password reset instructions mailed to %name at %email.', array('%name' => $account->name, '%email' => $account->mail));
        drupal_set_message(t('Further instructions have been sent to your e-mail address.'));
      }

      $form_state->setRedirectUrl(Url::fromRoute('user.page'));
    }
    return;
  }

}
