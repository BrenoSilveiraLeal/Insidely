export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      Account: {
        Row: {
          access_token: string | null
          expires_at: number | null
          id: string
          id_token: string | null
          provider: string
          providerAccountId: string
          refresh_token: string | null
          scope: string | null
          session_state: string | null
          token_type: string | null
          type: string
          userId: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: number | null
          id: string
          id_token?: string | null
          provider: string
          providerAccountId: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type: string
          userId: string
        }
        Update: {
          access_token?: string | null
          expires_at?: number | null
          id?: string
          id_token?: string | null
          provider?: string
          providerAccountId?: string
          refresh_token?: string | null
          scope?: string | null
          session_state?: string | null
          token_type?: string | null
          type?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Account_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      AuditLog: {
        Row: {
          action: string
          actorAuthUserId: string
          createdAt: string
          id: string
          metadata: Json
          resourceid: string | null
        }
        Insert: {
          action: string
          actorAuthUserId: string
          createdAt?: string
          id?: string
          metadata?: Json
          resourceid?: string | null
        }
        Update: {
          action?: string
          actorAuthUserId?: string
          createdAt?: string
          id?: string
          metadata?: Json
          resourceid?: string | null
        }
        Relationships: []
      }
      Availability: {
        Row: {
          createdAt: string
          endsAt: string
          id: string
          isBooked: boolean
          professionalProfileId: string
          startsAt: string
        }
        Insert: {
          createdAt?: string
          endsAt: string
          id: string
          isBooked?: boolean
          professionalProfileId: string
          startsAt: string
        }
        Update: {
          createdAt?: string
          endsAt?: string
          id?: string
          isBooked?: boolean
          professionalProfileId?: string
          startsAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Availability_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Availability_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      Booking: {
        Row: {
          autoReleaseAt: string | null
          availabilityId: string | null
          consultantConfirmedAt: string | null
          createdAt: string
          customerConfirmedAt: string | null
          customerId: string
          disputedAt: string | null
          disputeReason: string | null
          durationMinutes: number
          feeCents: number
          goals: string
          id: string
          paymentConfirmedAt: string | null
          paymentRejectedAt: string | null
          paymentReportedAt: string | null
          professionalProfileId: string
          releaseEligibleAt: string | null
          startsAt: string
          status: Database["public"]["Enums"]["BookingStatus"]
          subtotalCents: number
          topics: string[] | null
          totalCents: number
          updatedAt: string
        }
        Insert: {
          autoReleaseAt?: string | null
          availabilityId?: string | null
          consultantConfirmedAt?: string | null
          createdAt?: string
          customerConfirmedAt?: string | null
          customerId: string
          disputedAt?: string | null
          disputeReason?: string | null
          durationMinutes: number
          feeCents: number
          goals: string
          id: string
          paymentConfirmedAt?: string | null
          paymentRejectedAt?: string | null
          paymentReportedAt?: string | null
          professionalProfileId: string
          releaseEligibleAt?: string | null
          startsAt: string
          status?: Database["public"]["Enums"]["BookingStatus"]
          subtotalCents: number
          topics?: string[] | null
          totalCents: number
          updatedAt: string
        }
        Update: {
          autoReleaseAt?: string | null
          availabilityId?: string | null
          consultantConfirmedAt?: string | null
          createdAt?: string
          customerConfirmedAt?: string | null
          customerId?: string
          disputedAt?: string | null
          disputeReason?: string | null
          durationMinutes?: number
          feeCents?: number
          goals?: string
          id?: string
          paymentConfirmedAt?: string | null
          paymentRejectedAt?: string | null
          paymentReportedAt?: string | null
          professionalProfileId?: string
          releaseEligibleAt?: string | null
          startsAt?: string
          status?: Database["public"]["Enums"]["BookingStatus"]
          subtotalCents?: number
          topics?: string[] | null
          totalCents?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Booking_availabilityId_fkey"
            columns: ["availabilityId"]
            isOneToOne: false
            referencedRelation: "Availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Booking_customerId_fkey"
            columns: ["customerId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Booking_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Booking_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      Company: {
        Row: {
          color: string
          createdAt: string
          description: string
          id: string
          location: string
          logoText: string
          name: string
          sector: string
          slug: string
          updatedAt: string
        }
        Insert: {
          color: string
          createdAt?: string
          description: string
          id: string
          location: string
          logoText: string
          name: string
          sector: string
          slug: string
          updatedAt: string
        }
        Update: {
          color?: string
          createdAt?: string
          description?: string
          id?: string
          location?: string
          logoText?: string
          name?: string
          sector?: string
          slug?: string
          updatedAt?: string
        }
        Relationships: []
      }
      Conversation: {
        Row: {
          bookingId: string
          createdAt: string
          id: string
          updatedAt: string
        }
        Insert: {
          bookingId: string
          createdAt?: string
          id: string
          updatedAt: string
        }
        Update: {
          bookingId?: string
          createdAt?: string
          id?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Conversation_bookingId_fkey"
            columns: ["bookingId"]
            isOneToOne: false
            referencedRelation: "Booking"
            referencedColumns: ["id"]
          },
        ]
      }
      EmploymentExperience: {
        Row: {
          area: string
          companyId: string
          createdAt: string
          endedAt: string | null
          id: string
          isCurrent: boolean
          professionalProfileId: string
          professionId: string
          startedAt: string
          summary: string
          title: string
        }
        Insert: {
          area: string
          companyId: string
          createdAt?: string
          endedAt?: string | null
          id: string
          isCurrent?: boolean
          professionalProfileId: string
          professionId: string
          startedAt: string
          summary: string
          title: string
        }
        Update: {
          area?: string
          companyId?: string
          createdAt?: string
          endedAt?: string | null
          id?: string
          isCurrent?: boolean
          professionalProfileId?: string
          professionId?: string
          startedAt?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "EmploymentExperience_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "Company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EmploymentExperience_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "public_company_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EmploymentExperience_companyId_fkey"
            columns: ["companyId"]
            isOneToOne: false
            referencedRelation: "public_company_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EmploymentExperience_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EmploymentExperience_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EmploymentExperience_professionId_fkey"
            columns: ["professionId"]
            isOneToOne: false
            referencedRelation: "Profession"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EmploymentExperience_professionId_fkey"
            columns: ["professionId"]
            isOneToOne: false
            referencedRelation: "public_profession_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EmploymentExperience_professionId_fkey"
            columns: ["professionId"]
            isOneToOne: false
            referencedRelation: "public_profession_details"
            referencedColumns: ["id"]
          },
        ]
      }
      Favorite: {
        Row: {
          createdAt: string
          id: string
          professionalProfileId: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id: string
          professionalProfileId: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          professionalProfileId?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Favorite_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Favorite_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Favorite_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Message: {
        Row: {
          body: string
          conversationId: string
          createdAt: string
          id: string
          readAt: string | null
          senderId: string
        }
        Insert: {
          body: string
          conversationId: string
          createdAt?: string
          id: string
          readAt?: string | null
          senderId: string
        }
        Update: {
          body?: string
          conversationId?: string
          createdAt?: string
          id?: string
          readAt?: string | null
          senderId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Message_conversationId_fkey"
            columns: ["conversationId"]
            isOneToOne: false
            referencedRelation: "Conversation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Message_senderId_fkey"
            columns: ["senderId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          body: string
          createdAt: string
          href: string | null
          id: string
          readAt: string | null
          title: string
          userId: string
        }
        Insert: {
          body: string
          createdAt?: string
          href?: string | null
          id: string
          readAt?: string | null
          title: string
          userId: string
        }
        Update: {
          body?: string
          createdAt?: string
          href?: string | null
          id?: string
          readAt?: string | null
          title?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Notification_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Payment: {
        Row: {
          amountCents: number
          bookingId: string
          createdAt: string
          id: string
          paidAt: string | null
          provider: string
          providerRef: string | null
          releasedAt: string | null
          status: Database["public"]["Enums"]["PaymentStatus"]
          updatedAt: string
        }
        Insert: {
          amountCents: number
          bookingId: string
          createdAt?: string
          id: string
          paidAt?: string | null
          provider?: string
          providerRef?: string | null
          releasedAt?: string | null
          status?: Database["public"]["Enums"]["PaymentStatus"]
          updatedAt: string
        }
        Update: {
          amountCents?: number
          bookingId?: string
          createdAt?: string
          id?: string
          paidAt?: string | null
          provider?: string
          providerRef?: string | null
          releasedAt?: string | null
          status?: Database["public"]["Enums"]["PaymentStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Payment_bookingId_fkey"
            columns: ["bookingId"]
            isOneToOne: false
            referencedRelation: "Booking"
            referencedColumns: ["id"]
          },
        ]
      }
      PaymentAuditEvent: {
        Row: {
          actorAuthId: string | null
          actorUserId: string | null
          bookingId: string
          createdAt: string
          id: string
          newBookingStatus: Database["public"]["Enums"]["BookingStatus"] | null
          newPaymentStatus: Database["public"]["Enums"]["PaymentStatus"] | null
          observation: string
          paymentId: string | null
          previousBookingStatus:
            | Database["public"]["Enums"]["BookingStatus"]
            | null
          previousPaymentStatus:
            | Database["public"]["Enums"]["PaymentStatus"]
            | null
        }
        Insert: {
          actorAuthId?: string | null
          actorUserId?: string | null
          bookingId: string
          createdAt?: string
          id?: string
          newBookingStatus?: Database["public"]["Enums"]["BookingStatus"] | null
          newPaymentStatus?: Database["public"]["Enums"]["PaymentStatus"] | null
          observation?: string
          paymentId?: string | null
          previousBookingStatus?:
            | Database["public"]["Enums"]["BookingStatus"]
            | null
          previousPaymentStatus?:
            | Database["public"]["Enums"]["PaymentStatus"]
            | null
        }
        Update: {
          actorAuthId?: string | null
          actorUserId?: string | null
          bookingId?: string
          createdAt?: string
          id?: string
          newBookingStatus?: Database["public"]["Enums"]["BookingStatus"] | null
          newPaymentStatus?: Database["public"]["Enums"]["PaymentStatus"] | null
          observation?: string
          paymentId?: string | null
          previousBookingStatus?:
            | Database["public"]["Enums"]["BookingStatus"]
            | null
          previousPaymentStatus?:
            | Database["public"]["Enums"]["PaymentStatus"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "PaymentAuditEvent_actorUserId_fkey"
            columns: ["actorUserId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PaymentAuditEvent_bookingId_fkey"
            columns: ["bookingId"]
            isOneToOne: false
            referencedRelation: "Booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PaymentAuditEvent_paymentId_fkey"
            columns: ["paymentId"]
            isOneToOne: false
            referencedRelation: "Payment"
            referencedColumns: ["id"]
          },
        ]
      }
      PrivacySettings: {
        Row: {
          id: string
          professionalProfileId: string
          searchableByCompany: boolean
          searchableByProfession: boolean
          showCity: boolean
          showCurrentCompany: boolean
          showExactDates: boolean
          showFullHistory: boolean
          showPhoto: boolean
          showRealName: boolean
          showSurname: boolean
          updatedAt: string
        }
        Insert: {
          id: string
          professionalProfileId: string
          searchableByCompany?: boolean
          searchableByProfession?: boolean
          showCity?: boolean
          showCurrentCompany?: boolean
          showExactDates?: boolean
          showFullHistory?: boolean
          showPhoto?: boolean
          showRealName?: boolean
          showSurname?: boolean
          updatedAt: string
        }
        Update: {
          id?: string
          professionalProfileId?: string
          searchableByCompany?: boolean
          searchableByProfession?: boolean
          showCity?: boolean
          showCurrentCompany?: boolean
          showExactDates?: boolean
          showFullHistory?: boolean
          showPhoto?: boolean
          showRealName?: boolean
          showSurname?: boolean
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "PrivacySettings_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PrivacySettings_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      Profession: {
        Row: {
          accent: string
          category: string
          createdAt: string
          description: string
          id: string
          name: string
          slug: string
          updatedAt: string
        }
        Insert: {
          accent: string
          category: string
          createdAt?: string
          description: string
          id: string
          name: string
          slug: string
          updatedAt: string
        }
        Update: {
          accent?: string
          category?: string
          createdAt?: string
          description?: string
          id?: string
          name?: string
          slug?: string
          updatedAt?: string
        }
        Relationships: []
      }
      ProfessionalProfile: {
        Row: {
          avatarSeed: string
          bio: string
          boundaries: string[] | null
          createdAt: string
          headline: string
          id: string
          isActive: boolean
          location: string
          pixKey: string | null
          publicSurname: string | null
          price30Cents: number
          price60Cents: number
          privacyMode: Database["public"]["Enums"]["PrivacyMode"]
          pseudonym: string | null
          region: string
          responseHours: number
          seniority: Database["public"]["Enums"]["Seniority"]
          topics: string[] | null
          updatedAt: string
          userId: string
          verificationStatus: Database["public"]["Enums"]["VerificationStatus"]
          workMode: Database["public"]["Enums"]["WorkMode"]
          yearsExperience: number
        }
        Insert: {
          avatarSeed: string
          bio: string
          boundaries?: string[] | null
          createdAt?: string
          headline: string
          id: string
          isActive?: boolean
          location: string
          pixKey?: string | null
          publicSurname?: string | null
          price30Cents: number
          price60Cents: number
          privacyMode?: Database["public"]["Enums"]["PrivacyMode"]
          pseudonym?: string | null
          region: string
          responseHours?: number
          seniority: Database["public"]["Enums"]["Seniority"]
          topics?: string[] | null
          updatedAt: string
          userId: string
          verificationStatus?: Database["public"]["Enums"]["VerificationStatus"]
          workMode: Database["public"]["Enums"]["WorkMode"]
          yearsExperience: number
        }
        Update: {
          avatarSeed?: string
          bio?: string
          boundaries?: string[] | null
          createdAt?: string
          headline?: string
          id?: string
          isActive?: boolean
          location?: string
          pixKey?: string | null
          publicSurname?: string | null
          price30Cents?: number
          price60Cents?: number
          privacyMode?: Database["public"]["Enums"]["PrivacyMode"]
          pseudonym?: string | null
          region?: string
          responseHours?: number
          seniority?: Database["public"]["Enums"]["Seniority"]
          topics?: string[] | null
          updatedAt?: string
          userId?: string
          verificationStatus?: Database["public"]["Enums"]["VerificationStatus"]
          workMode?: Database["public"]["Enums"]["WorkMode"]
          yearsExperience?: number
        }
        Relationships: [
          {
            foreignKeyName: "ProfessionalProfile_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      ProfileView: {
        Row: {
          id: string
          professionalProfileId: string
          viewedAt: string
          viewerHash: string
        }
        Insert: {
          id: string
          professionalProfileId: string
          viewedAt?: string
          viewerHash: string
        }
        Update: {
          id?: string
          professionalProfileId?: string
          viewedAt?: string
          viewerHash?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProfileView_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProfileView_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      RealityCheck: {
        Row: {
          createdAt: string
          id: string
          imagined: string[] | null
          intro: string
          practical: string[] | null
          professionId: string
          routine: Json
          title: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id: string
          imagined?: string[] | null
          intro: string
          practical?: string[] | null
          professionId: string
          routine: Json
          title: string
          updatedAt: string
        }
        Update: {
          createdAt?: string
          id?: string
          imagined?: string[] | null
          intro?: string
          practical?: string[] | null
          professionId?: string
          routine?: Json
          title?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "RealityCheck_professionId_fkey"
            columns: ["professionId"]
            isOneToOne: false
            referencedRelation: "Profession"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RealityCheck_professionId_fkey"
            columns: ["professionId"]
            isOneToOne: false
            referencedRelation: "public_profession_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RealityCheck_professionId_fkey"
            columns: ["professionId"]
            isOneToOne: false
            referencedRelation: "public_profession_details"
            referencedColumns: ["id"]
          },
        ]
      }
      Report: {
        Row: {
          bookingId: string | null
          category: string
          createdAt: string
          description: string
          id: string
          reporterId: string
          resolution: string | null
          status: Database["public"]["Enums"]["ReportStatus"]
          targetUserId: string | null
          updatedAt: string
        }
        Insert: {
          bookingId?: string | null
          category: string
          createdAt?: string
          description: string
          id: string
          reporterId: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["ReportStatus"]
          targetUserId?: string | null
          updatedAt: string
        }
        Update: {
          bookingId?: string | null
          category?: string
          createdAt?: string
          description?: string
          id?: string
          reporterId?: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["ReportStatus"]
          targetUserId?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Report_bookingId_fkey"
            columns: ["bookingId"]
            isOneToOne: false
            referencedRelation: "Booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Report_reporterId_fkey"
            columns: ["reporterId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Report_targetUserId_fkey"
            columns: ["targetUserId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Review: {
        Row: {
          bookingId: string
          clarity: number
          comment: string | null
          contextualization: number
          createdAt: string
          id: string
          professionalProfileId: string
          rating: number
          usefulness: number
          userId: string
        }
        Insert: {
          bookingId: string
          clarity: number
          comment?: string | null
          contextualization: number
          createdAt?: string
          id: string
          professionalProfileId: string
          rating: number
          usefulness: number
          userId: string
        }
        Update: {
          bookingId?: string
          clarity?: number
          comment?: string | null
          contextualization?: number
          createdAt?: string
          id?: string
          professionalProfileId?: string
          rating?: number
          usefulness?: number
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Review_bookingId_fkey"
            columns: ["bookingId"]
            isOneToOne: false
            referencedRelation: "Booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Review_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Review_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Review_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Session: {
        Row: {
          expires: string
          id: string
          sessionToken: string
          userId: string
        }
        Insert: {
          expires: string
          id: string
          sessionToken: string
          userId: string
        }
        Update: {
          expires?: string
          id?: string
          sessionToken?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Session_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          auth_user_id: string | null
          createdAt: string
          email: string
          emailVerified: string | null
          failedLoginAttempts: number
          id: string
          image: string | null
          lastFailedLoginAt: string | null
          lockedUntil: string | null
          name: string
          onboardingCompleted: boolean
          passwordHash: string | null
          role: Database["public"]["Enums"]["Role"]
          twoFactorEnabled: boolean
          twoFactorRecoveryCodes: string[]
          twoFactorSecret: string | null
          twoFactorSetupExpiresAt: string | null
          twoFactorSetupSecret: string | null
          updatedAt: string
        }
        Insert: {
          auth_user_id?: string | null
          createdAt?: string
          email: string
          emailVerified?: string | null
          failedLoginAttempts?: number
          id: string
          image?: string | null
          lastFailedLoginAt?: string | null
          lockedUntil?: string | null
          name: string
          onboardingCompleted?: boolean
          passwordHash?: string | null
          role?: Database["public"]["Enums"]["Role"]
          twoFactorEnabled?: boolean
          twoFactorRecoveryCodes?: string[]
          twoFactorSecret?: string | null
          twoFactorSetupExpiresAt?: string | null
          twoFactorSetupSecret?: string | null
          updatedAt: string
        }
        Update: {
          auth_user_id?: string | null
          createdAt?: string
          email?: string
          emailVerified?: string | null
          failedLoginAttempts?: number
          id?: string
          image?: string | null
          lastFailedLoginAt?: string | null
          lockedUntil?: string | null
          name?: string
          onboardingCompleted?: boolean
          passwordHash?: string | null
          role?: Database["public"]["Enums"]["Role"]
          twoFactorEnabled?: boolean
          twoFactorRecoveryCodes?: string[]
          twoFactorSecret?: string | null
          twoFactorSetupExpiresAt?: string | null
          twoFactorSetupSecret?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      Verification: {
        Row: {
          adminNotes: string | null
          createdAt: string
          id: string
          method: string
          professionalProfileId: string
          reviewedAt: string | null
          reviewerId: string | null
          status: Database["public"]["Enums"]["VerificationStatus"]
          updatedAt: string
        }
        Insert: {
          adminNotes?: string | null
          createdAt?: string
          id: string
          method: string
          professionalProfileId: string
          reviewedAt?: string | null
          reviewerId?: string | null
          status?: Database["public"]["Enums"]["VerificationStatus"]
          updatedAt: string
        }
        Update: {
          adminNotes?: string | null
          createdAt?: string
          id?: string
          method?: string
          professionalProfileId?: string
          reviewedAt?: string | null
          reviewerId?: string | null
          status?: Database["public"]["Enums"]["VerificationStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Verification_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "ProfessionalProfile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Verification_professionalProfileId_fkey"
            columns: ["professionalProfileId"]
            isOneToOne: false
            referencedRelation: "public_profile_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      VerificationDocument: {
        Row: {
          createdAt: string
          id: string
          mimeType: string
          originalName: string
          sizeBytes: number
          storageKey: string
          verificationId: string
        }
        Insert: {
          createdAt?: string
          id: string
          mimeType: string
          originalName: string
          sizeBytes: number
          storageKey: string
          verificationId: string
        }
        Update: {
          createdAt?: string
          id?: string
          mimeType?: string
          originalName?: string
          sizeBytes?: number
          storageKey?: string
          verificationId?: string
        }
        Relationships: [
          {
            foreignKeyName: "VerificationDocument_verificationId_fkey"
            columns: ["verificationId"]
            isOneToOne: false
            referencedRelation: "Verification"
            referencedColumns: ["id"]
          },
        ]
      }
      VerificationToken: {
        Row: {
          expires: string
          identifier: string
          token: string
        }
        Insert: {
          expires: string
          identifier: string
          token: string
        }
        Update: {
          expires?: string
          identifier?: string
          token?: string
        }
        Relationships: []
      }
    }
    Views: {
      home_metrics: {
        Row: {
          active_professionals: number | null
          average_rating: number | null
          completed_conversations: number | null
          represented_companies: number | null
        }
        Relationships: []
      }
      public_company_cards: {
        Row: {
          _count: Json | null
          color: string | null
          createdAt: string | null
          description: string | null
          id: string | null
          location: string | null
          logoText: string | null
          name: string | null
          sector: string | null
          slug: string | null
          updatedAt: string | null
        }
        Insert: {
          _count?: never
          color?: string | null
          createdAt?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          logoText?: string | null
          name?: string | null
          sector?: string | null
          slug?: string | null
          updatedAt?: string | null
        }
        Update: {
          _count?: never
          color?: string | null
          createdAt?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          logoText?: string | null
          name?: string | null
          sector?: string | null
          slug?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      public_company_details: {
        Row: {
          _count: Json | null
          color: string | null
          description: string | null
          id: string | null
          location: string | null
          logoText: string | null
          name: string | null
          sector: string | null
          slug: string | null
        }
        Insert: {
          _count?: never
          color?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          logoText?: string | null
          name?: string | null
          sector?: string | null
          slug?: string | null
        }
        Update: {
          _count?: never
          color?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          logoText?: string | null
          name?: string | null
          sector?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      public_profession_cards: {
        Row: {
          _count: Json | null
          accent: string | null
          category: string | null
          createdAt: string | null
          description: string | null
          id: string | null
          name: string | null
          slug: string | null
          updatedAt: string | null
        }
        Insert: {
          _count?: never
          accent?: string | null
          category?: string | null
          createdAt?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
          updatedAt?: string | null
        }
        Update: {
          _count?: never
          accent?: string | null
          category?: string | null
          createdAt?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      public_profession_details: {
        Row: {
          _count: Json | null
          accent: string | null
          category: string | null
          description: string | null
          id: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          _count?: never
          accent?: string | null
          category?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          _count?: never
          accent?: string | null
          category?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      public_profile_cards: {
        Row: {
          availability: Json | null
          bio: string | null
          boundaries: string[] | null
          experiences: Json | null
          headline: string | null
          id: string | null
          location: string | null
          price30Cents: number | null
          price60Cents: number | null
          privacy: Json | null
          privacyMode: Database["public"]["Enums"]["PrivacyMode"] | null
          pseudonym: string | null
          region: string | null
          responseHours: number | null
          reviews: Json | null
          seniority: Database["public"]["Enums"]["Seniority"] | null
          topics: string[] | null
          user: Json | null
          verificationStatus:
            | Database["public"]["Enums"]["VerificationStatus"]
            | null
          workMode: Database["public"]["Enums"]["WorkMode"] | null
          yearsExperience: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_review_verification: { Args: { p_verification_id: string; p_decision: string }; Returns: undefined }
      admin_resolve_report: { Args: { p_report_id: string; p_decision: string }; Returns: undefined }
      admin_confirm_booking_payment: {
        Args: { p_booking_id: string; p_observation?: string }
        Returns: Database["public"]["Enums"]["PaymentStatus"]
      }
      create_booking: {
        Args: {
          p_duration: number
          p_goals: string
          p_profile_id: string
          p_slot_id: string
          p_topics: string[]
        }
        Returns: string
      }
      complete_onboarding: { Args: { p_role: string; p_payload: Json }; Returns: undefined }
      complete_booking: { Args: { p_booking_id: string }; Returns: undefined }
      confirm_booking: { Args: { p_booking_id: string }; Returns: undefined }
      dispute_booking: { Args: { p_booking_id: string; p_description: string }; Returns: undefined }
      create_support_report: { Args: { p_category: string; p_description: string }; Returns: undefined }
      create_profile_report: { Args: { p_category: string; p_description: string; p_profile_id: string }; Returns: undefined }
      create_consultant_availability: {
        Args: { p_ends_at: string; p_starts_at: string; p_user_id: string }
        Returns: Json
      }
      create_review: {
        Args: { p_booking_id: string; p_comment: string; p_rating: number }
        Returns: undefined
      }
      get_consultant_dashboard: { Args: { p_user_id: string }; Returns: Json }
      get_viewer_dashboard: { Args: { p_user_id: string }; Returns: Json }
      health_check: { Args: Record<PropertyKey, never>; Returns: Json }
      search_public_profiles: { Args: { p_query?: string; p_company_slug?: string; p_profession_slug?: string; p_work_mode?: string; p_location?: string; p_limit?: number; p_offset?: number }; Returns: Json }
      release_eligible_bookings_for_user: { Args: Record<PropertyKey, never>; Returns: number }
      release_eligible_bookings_system: { Args: Record<PropertyKey, never>; Returns: number }
      remove_consultant_availability: {
        Args: { p_availability_id: string }
        Returns: string
      }
      report_booking_payment: {
        Args: { p_booking_id: string; p_method?: string }
        Returns: Database["public"]["Enums"]["PaymentStatus"]
      }
      send_message: {
        Args: { p_body: string; p_conversation_id: string }
        Returns: undefined
      }
      set_recording_consent: { Args: { p_booking_id: string; p_consented: boolean }; Returns: undefined }
      submit_verification: { Args: { p_storage_key: string; p_original_name: string; p_mime_type: string; p_size_bytes: number; p_method: string }; Returns: undefined }
      sync_google_profile: {
        Args: { p_image: string; p_name: string }
        Returns: {
          onboardingCompleted: boolean
          role: string
        }[]
      }
      sync_social_profile: {
        Args: { p_image: string | null; p_name: string }
        Returns: { onboardingCompleted: boolean; role: string }[]
      }
      toggle_favorite: { Args: { p_profile_id: string }; Returns: undefined }
      update_privacy: { Args: { p_payload: Json }; Returns: undefined }
      update_professional_profile: {
        Args: { p_payload: Json }
        Returns: undefined
      }
      update_profile_image: { Args: { p_image: string | null }; Returns: undefined }
    }
    Enums: {
      BookingStatus:
        | "PENDING_PAYMENT"
        | "CONFIRMED"
        | "COMPLETED"
        | "CANCELLED"
        | "NO_SHOW"
        | "AWAITING_CONFIRMATION"
        | "DISPUTED"
        | "IN_PROGRESS"
        | "COMPLETED_RELEASE_PENDING"
      PaymentStatus:
        | "PENDING"
        | "APPROVED"
        | "REFUNDED"
        | "FAILED"
        | "HELD"
        | "RELEASED"
        | "DISPUTED"
        | "PAYMENT_REPORTED"
        | "PAID_HELD"
      PrivacyMode: "PUBLIC" | "PROTECTED" | "PSEUDONYM"
      ReportStatus: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED"
      Role: "USER" | "CONSULTANT" | "ADMIN"
      Seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "MANAGER"
      VerificationStatus:
        | "NOT_SUBMITTED"
        | "PENDING"
        | "VERIFIED"
        | "REJECTED"
        | "MORE_INFO_REQUIRED"
      WorkMode: "REMOTE" | "HYBRID" | "ONSITE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      BookingStatus: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
        "AWAITING_CONFIRMATION",
        "DISPUTED",
        "IN_PROGRESS",
        "COMPLETED_RELEASE_PENDING",
      ],
      PaymentStatus: [
        "PENDING",
        "APPROVED",
        "REFUNDED",
        "FAILED",
        "HELD",
        "RELEASED",
        "DISPUTED",
        "PAYMENT_REPORTED",
        "PAID_HELD",
      ],
      PrivacyMode: ["PUBLIC", "PROTECTED", "PSEUDONYM"],
      ReportStatus: ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"],
      Role: ["USER", "CONSULTANT", "ADMIN"],
      Seniority: ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"],
      VerificationStatus: [
        "NOT_SUBMITTED",
        "PENDING",
        "VERIFIED",
        "REJECTED",
        "MORE_INFO_REQUIRED",
      ],
      WorkMode: ["REMOTE", "HYBRID", "ONSITE"],
    },
  },
} as const
